"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Turnstile } from "@/components/security/turnstile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function ForgotPasswordForm({ turnstileSiteKey }: { turnstileSiteKey: string | null }) {
  const [email, setEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (turnstileSiteKey && !turnstileToken) {
      setError("Please complete the anti-bot verification.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          turnstileToken: turnstileToken ?? undefined,
        }),
      });
      // Server returns 200 regardless of whether the email exists (anti-enumeration).
      setDone(true);
    } catch (e) {
      setError((e as Error).message ?? "Network error.");
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <AuthShell title="Check your email">
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Request received</AlertTitle>
          <AlertDescription>
            If an account exists for <span className="font-medium">{email || "that address"}</span>,
            we&apos;ve sent a reset link. The link expires in 1 hour.
          </AlertDescription>
        </Alert>
        <div className="mt-4 flex flex-col gap-2">
          <Button asChild variant="outline">
            <Link href="/login">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to sign in
            </Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Forgot password"
      description="Enter your email and we'll send you a reset link"
      footer={
        <Link href="/login" className="inline-flex items-center hover:underline">
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to sign in
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
          />
        </div>

        {turnstileSiteKey ? (
          <div className="flex justify-center">
            <Turnstile onVerify={setTurnstileToken} onExpire={() => setTurnstileToken(null)} onError={() => setTurnstileToken(null)} />
          </div>
        ) : null}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
            </>
          ) : (
            "Send reset link"
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
