/**
 * ResendEmailProvider — uses the Resend HTTP API (https://resend.com).
 *
 * Real architecture. Marked NOT_CONFIGURED unless EMAIL_API_KEY is present
 * AND EMAIL_PROVIDER=resend (or unspecified — the factory will only construct
 * this class when resend is selected).
 *
 * We never fake a connection.
 */
import { Resend } from "resend";
import type { EmailProvider, EmailMessage, EmailSendResult } from "./types";
import {
  verificationEmail, passwordResetEmail, securityNotificationEmail,
  billingEmail, apiNotificationEmail,
} from "./templates";

const API_KEY = process.env.EMAIL_API_KEY ?? "";
const FROM = process.env.EMAIL_FROM ?? "";

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

export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";
  readonly configured: boolean;
  private client: Resend | null = null;

  constructor() {
    this.configured = !!API_KEY;
    if (this.configured) {
      // Real Resend client. The API key is read from env at runtime — never
      // logged, never hardcoded.
      this.client = new Resend(API_KEY);
    }
  }

  private resolveFrom(message: EmailMessage): string {
    return message.from ?? FROM ?? "NexTool <onboarding@resend.dev>";
  }

  private requireClient(): Resend {
    if (!this.client) {
      throw new Error(
        "Resend email is not configured. Set EMAIL_API_KEY (and EMAIL_FROM " +
        "to your verified sending domain) in .env to enable real email delivery."
      );
    }
    return this.client;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const client = this.requireClient();
    try {
      const { data, error } = await client.emails.send({
        from: this.resolveFrom(message),
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      if (error) {
        return { ok: false, error: error.message };
      }
      return { ok: true, messageId: data?.id };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  async sendVerification(to: string, token: string): Promise<EmailSendResult> {
    return this.send({
      to,
      subject: "Verify your NexTool email",
      html: verificationEmail(buildVerificationUrl(token)),
      text: `Verify your email: ${buildVerificationUrl(token)}`,
    });
  }

  async sendPasswordReset(to: string, token: string): Promise<EmailSendResult> {
    return this.send({
      to,
      subject: "Reset your NexTool password",
      html: passwordResetEmail(buildResetUrl(token)),
      text: `Reset your password: ${buildResetUrl(token)}`,
    });
  }

  async sendSecurityNotification(to: string, subject: string, body: string): Promise<EmailSendResult> {
    return this.send({
      to, subject,
      html: securityNotificationEmail(subject, body),
      text: body,
    });
  }

  async sendBilling(to: string, subject: string, body: string): Promise<EmailSendResult> {
    return this.send({
      to, subject,
      html: billingEmail(subject, body),
      text: body,
    });
  }

  async sendApiNotification(to: string, subject: string, body: string): Promise<EmailSendResult> {
    return this.send({
      to, subject,
      html: apiNotificationEmail(subject, body),
      text: body,
    });
  }
}
