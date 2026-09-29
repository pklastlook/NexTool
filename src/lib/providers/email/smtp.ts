/**
 * SmtpEmailProvider — generic SMTP via nodemailer (Prompt2 §1, §77).
 *
 * Real architecture. Marked NOT_CONFIGURED unless ALL of
 * EMAIL_SMTP_HOST, EMAIL_SMTP_USER, EMAIL_SMTP_PASS are present (EMAIL_SMTP_PORT
 * defaults to 587, EMAIL_SMTP_SECURE="true" switches to TLS-on-connect 465).
 *
 * We never fake a connection: when not configured, every send method throws a
 * clear error explaining exactly which env vars are missing.
 */
import nodemailer, { type Transporter } from "nodemailer";
import type { EmailProvider, EmailMessage, EmailSendResult } from "./types";
import {
  verificationEmail, passwordResetEmail, securityNotificationEmail,
  billingEmail, apiNotificationEmail,
} from "./templates";

const HOST = process.env.EMAIL_SMTP_HOST ?? "";
const PORT = Number(process.env.EMAIL_SMTP_PORT ?? 587);
const SECURE = process.env.EMAIL_SMTP_SECURE === "true" || PORT === 465;
const USER = process.env.EMAIL_SMTP_USER ?? "";
const PASS = process.env.EMAIL_SMTP_PASS ?? "";
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

export class SmtpEmailProvider implements EmailProvider {
  readonly name = "smtp";
  readonly configured: boolean;
  private transporter: Transporter | null = null;

  constructor() {
    this.configured = !!(HOST && USER && PASS);
    if (this.configured) {
      // Build a real SMTP transport. No fake connection.
      this.transporter = nodemailer.createTransport({
        host: HOST,
        port: PORT,
        secure: SECURE,
        auth: { user: USER, pass: PASS },
      });
    }
  }

  private resolveFrom(message: EmailMessage): string {
    return message.from ?? FROM ?? `NexTool <no-reply@${HOST || "localhost"}>`;
  }

  private requireTransporter(): Transporter {
    if (!this.transporter) {
      throw new Error(
        "SMTP email is not configured. Set EMAIL_SMTP_HOST, EMAIL_SMTP_USER, " +
        "EMAIL_SMTP_PASS (and optionally EMAIL_SMTP_PORT / EMAIL_SMTP_SECURE " +
        "/ EMAIL_FROM) in .env to enable real email delivery."
      );
    }
    return this.transporter;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const transporter = this.requireTransporter();
    try {
      const info = await transporter.sendMail({
        from: this.resolveFrom(message),
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      return { ok: true, messageId: info.messageId };
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
