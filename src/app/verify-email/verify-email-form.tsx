"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2, MailWarning, ArrowLeft } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function VerifyEmailForm({
  initialToken,
  initialSuccess,
}: {
  initialToken: string | null;
  initialSuccess: boolean;
}) {
  const [token, setToken] = useState(initialToken ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(initialSuccess);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (!token.trim()) {
      setError("Please paste your verification token.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(
          data.error === "token_expired"
            ? "This verification link has expired. Please request a new one."
            : data.error === "invalid_or_expired_token" || data.error === "invalid_token"
              ? "Invalid verification token. Please check it and try again."
              : data.error ?? "Verification failed.",
        );
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch (e) {
      setError((e as Error).message ?? "Network error.");
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <AuthShell title="Email verified">
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>
            Your email is verified. You can now sign in to your account.
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button asChild className="w-full">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Verify your email"
      description="Paste the verification token we sent you"
      footer={
        <Link href="/login" className="inline-flex items-center hover:underline">
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to sign in
        </Link>
      }
    >
      <Alert>
        <MailWarning className="h-4 w-4" />
        <AlertDescription>
          Didn&apos;t get the email? Check your spam folder, or{" "}
          <Link href="/forgot-password" className="font-medium text-primary hover:underline">
            resend the verification link
          </Link>{" "}
          by triggering a password reset.
        </AlertDescription>
      </Alert>

      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="token">Verification token</Label>
          <Input
            id="token"
            name="token"
            type="text"
            required
            placeholder="Paste the token from your email"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={submitting}
          />
        </div>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…
            </>
          ) : (
            "Verify email"
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
