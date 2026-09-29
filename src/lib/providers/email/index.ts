/**
 * Email provider factory (Prompt2 §1, §77).
 *
 * Selection rules:
 *  - EMAIL_PROVIDER=smtp        -> SmtpEmailProvider (real SMTP)
 *  - EMAIL_PROVIDER=resend      -> ResendEmailProvider (real Resend API)
 *  - EMAIL_PROVIDER=console, "" -> ConsoleEmailProvider (dev, honest no-send)
 *
 * Each real provider is constructed safely (no constructor throws). If the
 * chosen provider is NOT_CONFIGURED, the factory returns it anyway so the
 * health system can report status honestly and callers can branch on
 * `configured`. Invoking a send on a NOT_CONFIGURED provider throws a clear
 * error explaining which env vars are missing.
 *
 * The instance is cached for the lifetime of the process.
 */
import type { EmailProvider } from "./types";
import { SmtpEmailProvider } from "./smtp";
import { ResendEmailProvider } from "./resend";
import { ConsoleEmailProvider } from "./console";

let cached: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (cached) return cached;

  const kind = (process.env.EMAIL_PROVIDER ?? "console").toLowerCase().trim();

  switch (kind) {
    case "smtp":
      cached = new SmtpEmailProvider();
      break;
    case "resend":
      cached = new ResendEmailProvider();
      break;
    case "console":
    case "":
      cached = new ConsoleEmailProvider();
      break;
    default:
      // Unknown provider — fail open to console with a warning, never throw.
      console.warn(
        `[email] Unknown EMAIL_PROVIDER="${kind}". Falling back to console (dev mode).`
      );
      cached = new ConsoleEmailProvider();
  }
  return cached;
}

export type {
  EmailProvider, EmailMessage, EmailSendResult, EmailProviderHandles,
} from "./types";
