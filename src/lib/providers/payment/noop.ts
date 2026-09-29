/**
 * NoopPaymentProvider — type-safe placeholder (Prompt2 §78).
 *
 * Returned by getPaymentProvider() when PAYMENT_SECRET is missing. Every
 * method throws a clear, actionable error. We never return fake success:
 * callers MUST see an explicit failure so they cannot accidentally ship a
 * feature that pretends to bill the user.
 */
import type {
  PaymentProvider, Plan, CheckoutSession, Subscription,
  WebhookEvent, CustomerPortalSession,
} from "./types";

const NOT_CONFIGURED_ERROR = new Error(
  "Payment provider is not configured. Set PAYMENT_PROVIDER=stripe and " +
  "PAYMENT_SECRET (plus PAYMENT_WEBHOOK_SECRET for inbound webhooks) in " +
  ".env to enable real checkout, subscriptions, and billing."
);

export class NoopPaymentProvider implements PaymentProvider {
  readonly name = "noop";
  readonly configured = false;

  async createCheckoutSession(
    _userId: string,
    _plan: Plan,
    _successUrl: string,
    _cancelUrl: string
  ): Promise<CheckoutSession> {
    throw NOT_CONFIGURED_ERROR;
  }

  async createSubscription(_userId: string, _plan: Plan): Promise<Subscription> {
    throw NOT_CONFIGURED_ERROR;
  }

  async cancelSubscription(_subscriptionId: string, _atPeriodEnd?: boolean): Promise<Subscription> {
    throw NOT_CONFIGURED_ERROR;
  }

  async getSubscription(_subscriptionId: string): Promise<Subscription | null> {
    throw NOT_CONFIGURED_ERROR;
  }

  async processWebhook(_rawBody: string | Buffer, _signature: string): Promise<WebhookEvent> {
    throw NOT_CONFIGURED_ERROR;
  }

  async createCustomerPortalSession(
    _customerId: string,
    _returnUrl: string
  ): Promise<CustomerPortalSession> {
    throw NOT_CONFIGURED_ERROR;
  }
}
