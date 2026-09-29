/**
 * PaymentProvider interface (Prompt2 §1, §63, §77, §78).
 *
 * Implementations:
 *  - StripePaymentProvider  — real Stripe SDK
 *  - NoopPaymentProvider    — type-safe placeholder that throws "not configured"
 *                             on every method (never fakes a successful charge)
 *
 * Per the master prompt's ABSOLUTE RULE: webhooks MUST be cryptographically
 * verified using the provider's signing secret — never trust query params like
 * `?payment=success`.
 */

/** A subscription/product plan. */
export interface Plan {
  /** Stable slug, e.g. "pro-monthly". */
  slug: string;
  /** Human-readable name. */
  name: string;
  /** Price in minor currency units (cents). */
  priceCents: number;
  /** ISO 4217 currency code, lowercased per Stripe convention. */
  currency: string;
  /** Billing interval. */
  interval: "month" | "year" | "one_time";
  /** The provider's price/plan ID (Stripe price_xxx). */
  providerPriceId: string;
}

/** A checkout session (Stripe Checkout or equivalent). */
export interface CheckoutSession {
  /** Provider session id (Stripe cs_test_...). */
  id: string;
  /** Absolute URL the client must visit to pay. */
  url: string;
  /** Owning user id (our DB). */
  userId: string;
  /** Plan slug chosen. */
  planSlug: string;
  /** Mode of the session. */
  mode: "payment" | "subscription" | "setup";
}

/** A subscription record. */
export interface Subscription {
  id: string;
  customerId: string;
  status:
  | "active" | "trialing" | "past_due" | "canceled"
  | "incomplete" | "incomplete_expired" | "unpaid" | "paused";
  planSlug: string;
  currentPeriodStart: number; // unix seconds
  currentPeriodEnd: number; // unix seconds
  cancelAtPeriodEnd: boolean;
}

/** A customer-portal session. */
export interface CustomerPortalSession {
  id: string;
  url: string;
}

/**
 * Normalized webhook event. Provider-agnostic shape so the rest of the app
 * never has to import the Stripe SDK.
 */
export interface WebhookEvent {
  /** Provider event type, e.g. "checkout.session.completed". */
  type: string;
  /** Provider event id (Stripe evt_...). */
  id: string;
  /** Subscription id when relevant. */
  subscriptionId?: string;
  /** Customer id when relevant. */
  customerId?: string;
  /** Amount in minor units, when relevant. */
  amount?: number;
  /** Currency code, when relevant. */
  currency?: string;
  /** Payment / subscription status, when relevant. */
  status?: string;
  /** Raw event payload for callers that need provider-specific fields. */
  raw: unknown;
}

/**
 * Payment provider contract. Implementations MUST:
 *  - Set `configured=false` when required env vars are missing.
 *  - NEVER throw from the constructor.
 *  - Throw a clear "not configured" error if a method is invoked while
 *    `configured` is false (so callers cannot silently pretend a charge went
 *    through — per Prompt2 §78).
 *  - Verify webhook signatures with the webhook secret only.
 */
export interface PaymentProvider {
  /** Lowercase identifier, e.g. "stripe", "noop". */
  readonly name: string;
  /** True when real credentials are present and the client was built. */
  readonly configured: boolean;
  /** Create a Stripe Checkout (or equivalent) session. */
  createCheckoutSession(
    userId: string,
    plan: Plan,
    successUrl: string,
    cancelUrl: string
  ): Promise<CheckoutSession>;
  /** Create a subscription for a user against a plan. */
  createSubscription(userId: string, plan: Plan): Promise<Subscription>;
  /** Cancel a subscription (optionally at period end). */
  cancelSubscription(subscriptionId: string, atPeriodEnd?: boolean): Promise<Subscription>;
  /** Retrieve a subscription by id. */
  getSubscription(subscriptionId: string): Promise<Subscription | null>;
  /** Verify and parse an inbound webhook. */
  processWebhook(rawBody: string | Buffer, signature: string): Promise<WebhookEvent>;
  /** Create a customer portal session (manage cards, cancel, etc). */
  createCustomerPortalSession(customerId: string, returnUrl: string): Promise<CustomerPortalSession>;
}
