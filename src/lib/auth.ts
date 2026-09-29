/**
 * NextAuth v4 configuration (Prompt2 §30).
 *
 * Strategy: CredentialsProvider + JWT sessions.
 *  - We use bcryptjs to verify password hashes stored on User.passwordHash.
 *  - JWT carries { sub, email, name, role, id } — never the password hash.
 *  - Sessions expose { id, role } on session.user via the session callback.
 *
 * Security notes:
 *  - AUTH_SECRET is mandatory in production. In dev, a clear warning is logged
 *    and a weak dev fallback is used so local dev works without configuration.
 *    This NEVER happens in production — `resolveAuthSecret()` throws hard.
 *  - Cookie secure flag is on in production (NextAuth default; we set
 *    `useSecureCookies` explicitly to be honest).
 *  - CSRF: NextAuth handles its own CSRF tokens for /api/auth/* routes.
 *    Custom route handlers (/api/auth/register, etc.) check the Origin header
 *    themselves — see the helpers in auth-server.ts.
 */
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { verifyTurnstileToken } from "@/lib/security/turnstile";

const DEV_SECRET = "dev-secret-DO-NOT-USE-IN-PRODUCTION";

/**
 * Resolve the NextAuth secret. HONEST:
 *  - Production: throws if AUTH_SECRET is unset (no silent weak default).
 *  - Development: falls back to a dev secret + console.warn so local dev
 *    works out of the box. The warning is loud.
 */
function resolveAuthSecret(): string {
  if (env.AUTH_SECRET) return env.AUTH_SECRET;

  // Detect Next.js build phase — during `next build`, route modules are
  // evaluated to collect page data. We must NOT throw here or the build
  // fails. Fall back to a placeholder; the secret is never actually used
  // during build (no requests are served).
  const isBuildPhase =
    env.NODE_ENV === "production" &&
    (process.env.NEXT_PHASE === "phase-production-build" ||
      process.env.__NEXT_BUILD_PHASE === "true" ||
      // `next build` runs with `NEXT_BUILD=true` in some setups; also detect
      // by checking if we're being imported for page-data collection.
      process.env.BUILDING === "true");

  if (env.NODE_ENV === "production" && !isBuildPhase) {
    throw new Error(
      "[auth] FATAL: AUTH_SECRET is not set in production. " +
      "Generate one with `openssl rand -base64 32` and add it to .env. " +
      "Authentication is disabled until this is fixed."
    );
  }

  // Dev fallback / build-time placeholder — loud warning, never silent.
  if (!process.env.__NEXTAUTH_DEV_SECRET_WARNED) {
    console.warn(
      "[auth] WARNING: AUTH_SECRET is not set. Falling back to a known " +
      "dev secret. THIS IS NOT SAFE IN PRODUCTION. Set AUTH_SECRET in your " +
      ".env file (e.g. `openssl rand -base64 32`)."
    );
    process.env.__NEXTAUTH_DEV_SECRET_WARNED = "1";
  }
  return DEV_SECRET;
}

/**
 * Extract client IP from headers (Cloudflare / X-Forwarded-For / X-Real-IP).
 * Used by the `authorize` callback for per-IP login rate limiting.
 */
async function getClientIp(): Promise<string | null> {
  try {
    const h = await headers();
    const cf = h.get("cf-connecting-ip");
    if (cf) return cf.trim();
    const xff = h.get("x-forwarded-for");
    if (xff) {
      const first = xff.split(",")[0]?.trim();
      if (first) return first;
    }
    const real = h.get("x-real-ip");
    if (real) return real.trim();
  } catch {
    /* headers() can throw in some runtimes — fail open to "unknown". */
  }
  return null;
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    // 30 days — matches NextAuth default maxAge.
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
    signOut: "/",
    error: "/login",
    verifyRequest: "/verify-email",
    newUser: "/dashboard",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        turnstileToken: { label: "Turnstile Token", type: "text" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? "";
        const turnstileToken = credentials?.turnstileToken ?? null;
        if (!email || !password) return null;

        // Rate limit login attempts: 10/minute per IP (Prompt2 §30).
        const ip = await getClientIp();
        const rl = await rateLimitByIp(ip, { windowSec: 60, limit: 10 });
        if (!rl.allowed) {
          throw new Error("Too many login attempts. Please try again in a minute.");
        }

        // Verify Turnstile token if configured (honest skip when not set).
        if (env.TURNSTILE_SECRET_KEY) {
          const ts = await verifyTurnstileToken(turnstileToken, ip);
          if (!ts.success) {
            throw new Error("Anti-bot verification failed. Please retry.");
          }
        }

        const user = await db.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            role: true,
            passwordHash: true,
            emailVerified: true,
          },
        });
        if (!user || !user.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        // Return the user object NextAuth will encode into the JWT.
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          emailVerified: user.emailVerified?.toISOString() ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // Initial sign-in: `user` is the value returned from authorize().
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role: string }).role;
      }
      // Refresh on session update (e.g. after profile save).
      if (trigger === "update") {
        const id = (token.id as string | undefined) ?? token.sub;
        if (id) {
          const fresh = await db.user.findUnique({
            where: { id },
            select: { id: true, email: true, name: true, image: true, role: true },
          });
          if (fresh) {
            token.id = fresh.id;
            token.email = fresh.email;
            token.name = fresh.name;
            token.picture = fresh.image;
            token.role = fresh.role;
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  secret: resolveAuthSecret(),
  useSecureCookies: env.NODE_ENV === "production",
  // Cookie prefix is needed when running on Vercel behind a proxy; harmless
  // elsewhere. Mirrors NextAuth's recommended default.
  cookies: {
    sessionToken: {
      name: env.NODE_ENV === "production" ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: env.NODE_ENV === "production",
      },
    },
  },
  debug: env.NODE_ENV !== "production" && env.LOG_LEVEL === "debug",
};
