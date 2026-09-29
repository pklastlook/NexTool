/**
 * NextAuth v4 type augmentation (Prompt2 §30).
 *
 * Adds `id` and `role` to the JWT token and to `session.user`.
 */
import "next-auth";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
  }
}
