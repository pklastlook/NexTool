/**
 * Payment provider factory (Prompt2 §1, §63, §77).
 *
 * Selection rules:
 *  - PAYMENT_PROVIDER=stripe (or unset) AND PAYMENT_SECRET present
 *      -> StripePaymentProvider
 *  - Otherwise
 *      -> NoopPaymentProvider (configured=false; every method throws clearly)
 *
 * The instance is cached for the lifetime of the process.
 */
import type { PaymentProvider } from "./types";
import { StripePaymentProvider } from "./stripe";
import { NoopPaymentProvider } from "./noop";

let cached: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;

  const kind = (process.env.PAYMENT_PROVIDER ?? "stripe").toLowerCase().trim();
  const hasSecret = !!process.env.PAYMENT_SECRET;

  if (kind === "stripe" && hasSecret) {
    cached = new StripePaymentProvider();
  } else if (kind === "stripe" && !hasSecret) {
    // Real architecture, NOT_CONFIGURED. Returned so the health system can
    // report status honestly and so callers can branch on `configured`.
    // Invoking any method throws a clear error.
    cached = new StripePaymentProvider();
  } else {
    cached = new NoopPaymentProvider();
  }
  return cached;
}

export type {
  PaymentProvider, Plan, CheckoutSession, Subscription,
  WebhookEvent, CustomerPortalSession,
} from "./types";
