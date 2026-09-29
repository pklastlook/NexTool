import { ResetPasswordForm } from "./reset-password-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Set a new password",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : null;
  return <ResetPasswordForm initialToken={token} />;
}
