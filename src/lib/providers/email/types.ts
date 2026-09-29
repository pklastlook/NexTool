/**
 * EmailProvider interface (Prompt2 §1, §77, §78).
 *
 * Implementations:
 *  - SmtpEmailProvider     — generic SMTP via nodemailer
 *  - ResendEmailProvider   — Resend HTTP API
 *  - ConsoleEmailProvider  — dev fallback (logs to console, clearly marked)
 *
 * Per the master prompt's ABSOLUTE RULE: never fake a connection. If the
 * required credentials are missing, the provider is constructed with
 * `configured=false` and its send methods throw a clear error on invocation.
 */
import type { Transporter } from "nodemailer";
import type { Resend } from "resend";

/** A normalized email message. Implementations accept this shape. */
export interface EmailMessage {
  /** Recipient email address. */
  to: string;
  /** From address (defaults to env EMAIL_FROM or per-provider default). */
  from?: string;
  /** Subject line. */
  subject: string;
  /** Full HTML body (must be valid, escaped, responsive). */
  html: string;
  /** Optional plain-text fallback. */
  text?: string;
}

/** Standard result returned by every send method. */
export interface EmailSendResult {
  /** Whether the send succeeded. */
  ok: boolean;
  /** Provider-issued message id when available. */
  messageId?: string;
  /** Human-readable error message when ok=false. */
  error?: string;
}

/**
 * Email provider contract. Implementations MUST:
 *  - Set `configured=false` when required env vars are missing.
 *  - NEVER throw from the constructor.
 *  - Throw a clear "not configured" error if a send method is invoked while
 *    `configured` is false (so callers cannot silently pretend an email went
 *    out — per Prompt2 §78).
 */
export interface EmailProvider {
  /** Lowercase identifier, e.g. "smtp", "resend", "console". */
  readonly name: string;
  /** True when real credentials are present and the transport was built. */
  readonly configured: boolean;
  /** Send a verification link (signup / email-change). */
  sendVerification(to: string, token: string): Promise<EmailSendResult>;
  /** Send a password-reset link. */
  sendPasswordReset(to: string, token: string): Promise<EmailSendResult>;
  /** Send a security notification (login from new device, password change, etc). */
  sendSecurityNotification(to: string, subject: string, body: string): Promise<EmailSendResult>;
  /** Send a billing receipt / invoice / subscription notice. */
  sendBilling(to: string, subject: string, body: string): Promise<EmailSendResult>;
  /** Send an API-related notification (key rotation, quota warning, webhook failure). */
  sendApiNotification(to: string, subject: string, body: string): Promise<EmailSendResult>;
  /** Low-level: send a fully-formed EmailMessage. Used by the typed methods above. */
  send(message: EmailMessage): Promise<EmailSendResult>;
}

/**
 * Holds the optional SDK handles that may be attached by concrete providers.
 * Exported so tests / health checks can inspect them safely (no secrets
 * leak through this type — only opaque SDK instances).
 */
export interface EmailProviderHandles {
  transporter?: Transporter;
  client?: Resend;
}
