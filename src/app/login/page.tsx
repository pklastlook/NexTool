import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { env } from "@/lib/env";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  // Already-authed users skip the login page.
  const session = await getServerSession(authOptions);
  if (session) {
    redirect(searchParams ? (await searchParams).callbackUrl ?? "/dashboard" : "/dashboard");
  }

  const sp = await searchParams;
  const callbackUrl = sp.callbackUrl ?? "/dashboard";
  const errorCode = sp.error;
  const turnstileSiteKey = env.TURNSTILE_SITE_KEY ?? null;

  return (
    <LoginForm
      callbackUrl={callbackUrl}
      errorCode={errorCode}
      turnstileSiteKey={turnstileSiteKey}
    />
  );
}
