/**
 * NextAuth v4 route handler (Prompt2 §30).
 *
 * Forwards GET/POST to the NextAuth handler built from `authOptions`.
 * All actual auth logic (sign-in, sign-out, JWT, session, CSRF) lives there.
 */
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
