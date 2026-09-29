/**
 * ConsoleEmailProvider — dev-only fallback (Prompt2 §77, §78).
 *
 * Used by the factory when EMAIL_PROVIDER is unset or set to "console".
 *
 * This provider is HONEST: it never claims an email was actually delivered.
 * It logs the would-be message to the server console with a clear
 * "[EMAIL:CONSOLE]" prefix and a banner reading "DEV MODE — NO EMAIL WAS SENT".
 *
 * It is "configured" in the sense that it can be invoked without throwing,
 * but every result reports ok:false with an explanatory error so callers can
 * detect that delivery did not happen. This prevents silent fakes.
 */
import type { EmailProvider, EmailMessage, EmailSendResult } from "./types";
import {
  verificationEmail, passwordResetEmail, securityNotificationEmail,
  billingEmail, apiNotificationEmail,
} from "./templates";

function buildVerificationUrl(token: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "";
  const base = appUrl.replace(/\/$/, "");
  return `${base}/verify-email?token=${encodeURIComponent(token)}`;
}

function buildResetUrl(token: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "";
  const base = appUrl.replace(/\/$/, "");
  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
}

export class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";
  readonly configured = true; // dev fallback — always usable, but never "really" sends

  private log(message: EmailMessage): EmailSendResult {
    // Never log secrets. We log only to/subject/text and a size summary.
    // The full HTML is intentionally omitted from the console to avoid noise.
    console.log(
      `[EMAIL:CONSOLE] DEV MODE — NO EMAIL WAS SENT.\n` +
      `  to:      ${message.to}\n` +
      `  from:    ${message.from ?? process.env.EMAIL_FROM ?? "(unset)"}\n` +
      `  subject: ${message.subject}\n` +
      `  text:    ${message.text?.slice(0, 240) ?? "(none)"}\n` +
      `  html:    ${message.html.length} bytes`
    );
    return {
      ok: false,
      error:
        "Email provider is console (dev mode). No email was actually sent. " +
        "Set EMAIL_PROVIDER=smtp|resend with the corresponding credentials " +
        "to enable real delivery.",
    };
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    return this.log(message);
  }

  async sendVerification(to: string, token: string): Promise<EmailSendResult> {
    return this.log({
      to,
      subject: "Verify your NexTool email",
      html: verificationEmail(buildVerificationUrl(token)),
      text: `Verify your email: ${buildVerificationUrl(token)}`,
    });
  }

  async sendPasswordReset(to: string, token: string): Promise<EmailSendResult> {
    return this.log({
      to,
      subject: "Reset your NexTool password",
      html: passwordResetEmail(buildResetUrl(token)),
      text: `Reset your password: ${buildResetUrl(token)}`,
    });
  }

  async sendSecurityNotification(to: string, subject: string, body: string): Promise<EmailSendResult> {
    return this.log({
      to, subject,
      html: securityNotificationEmail(subject, body),
      text: body,
    });
  }

  async sendBilling(to: string, subject: string, body: string): Promise<EmailSendResult> {
    return this.log({
      to, subject,
      html: billingEmail(subject, body),
      text: body,
    });
  }

  async sendApiNotification(to: string, subject: string, body: string): Promise<EmailSendResult> {
    return this.log({
      to, subject,
      html: apiNotificationEmail(subject, body),
      text: body,
    });
  }
}
