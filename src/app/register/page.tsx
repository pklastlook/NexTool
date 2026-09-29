import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { env } from "@/lib/env";
import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Create an account",
};

export default async function RegisterPage() {
  // Already-authed users skip the register page.
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  const turnstileSiteKey = env.TURNSTILE_SITE_KEY ?? null;

  return <RegisterForm turnstileSiteKey={turnstileSiteKey} />;
}
