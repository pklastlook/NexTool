import { env } from "@/lib/env";
import { ForgotPasswordForm } from "./forgot-password-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reset your password",
};

export default function ForgotPasswordPage() {
  const turnstileSiteKey = env.TURNSTILE_SITE_KEY ?? null;
  return <ForgotPasswordForm turnstileSiteKey={turnstileSiteKey} />;
}
