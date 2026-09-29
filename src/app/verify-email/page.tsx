import { VerifyEmailForm } from "./verify-email-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Verify your email",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; success?: string }>;
}) {
  const sp = await searchParams;
  const initialToken = typeof sp.token === "string" ? sp.token : null;
  const successFlag = sp.success === "1";
  return <VerifyEmailForm initialToken={initialToken} initialSuccess={successFlag} />;
}
