/**
 * StripePaymentProvider — real Stripe SDK integration (Prompt2 §1, §63, §77, §78).
 *
 * Marked NOT_CONFIGURED unless PAYMENT_SECRET is set. The webhook secret
 * (PAYMENT_WEBHOOK_SECRET) is required by processWebhook(): if missing, that
 * method throws — we NEVER trust ?payment=success query params.
 *
 * We never fake a charge. When NOT_CONFIGURED every method throws a clear error
 * explaining which env vars are missing.
 */
import Stripe from "stripe";
import type {
  PaymentProvider, Plan, CheckoutSession, Subscription,
  WebhookEvent, CustomerPortalSession,
} from "./types";

const SECRET = process.env.PAYMENT_SECRET ?? "";
const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET ?? "";
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");

/** Map a Stripe subscription status to our normalized status union. */
function mapStatus(s: Stripe.Subscription.Status): Subscription["status"] {
  // Stripe uses the same vocabulary as our union — but TS doesn't know that
  // (its union is wider). Cast through a record for safety.
  const allowed: Record<string, Subscription["status"]> = {
    active: "active",
    trialing: "trialing",
    past_due: "past_due",
    canceled: "canceled",
    incomplete: "incomplete",
    incomplete_expired: "incomplete_expired",
    unpaid: "unpaid",
    paused: "paused",
  };
  return allowed[s] ?? "incomplete";
}

/** Convert a Stripe Subscription object into our normalized Subscription. */
function toSubscription(s: Stripe.Subscription, planSlug: string): Subscription {
  // In Stripe API v22+ the current-period fields live on the subscription
  // *item*, not the subscription itself. Take the first item's period.
  const firstItem = s.items?.data?.[0];
  return {
    id: s.id,
    customerId: typeof s.customer === "string" ? s.customer : s.customer?.id ?? "",
    status: mapStatus(s.status),
    planSlug,
    currentPeriodStart: firstItem?.current_period_start ?? s.start_date,
    currentPeriodEnd: firstItem?.current_period_end ?? 0,
    cancelAtPeriodEnd: s.cancel_at_period_end,
  };
}

export class StripePaymentProvider implements PaymentProvider {
  readonly name = "stripe";
  readonly configured: boolean;
  private client: Stripe | null = null;

  constructor() {
    this.configured = !!SECRET;
    if (this.configured) {
      // Real Stripe client. Secret read from env at runtime — never logged.
      // Pin the API version so Stripe responses are stable across SDK bumps.
      this.client = new Stripe(SECRET, {
        // The SDK ships with a LatestApiVersion constant; we let the SDK pick
        // its default by omitting apiVersion.
        appInfo: { name: "NexTool", version: "1.0.0" },
      });
    }
  }

  private requireClient(): Stripe {
    if (!this.client) {
      throw new Error(
        "Stripe payment provider is not configured. Set PAYMENT_SECRET " +
        "(and PAYMENT_WEBHOOK_SECRET for inbound webhooks) in .env to enable " +
        "real checkout, subscriptions, and webhook handling."
      );
    }
    return this.client;
  }

  async createCheckoutSession(
    userId: string,
    plan: Plan,
    successUrl: string,
    cancelUrl: string
  ): Promise<CheckoutSession> {
    const client = this.requireClient();
    const mode: "payment" | "subscription" =
      plan.interval === "one_time" ? "payment" : "subscription";

    const session = await client.checkout.sessions.create({
      mode,
      line_items: [{ price: plan.providerPriceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId,
      metadata: {
        userId,
        planSlug: plan.slug,
      },
      // Ask Stripe to expand subscription so callers can fetch it cheaply.
      expand: ["subscription"],
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL.");
    }
    return {
      id: session.id,
      url: session.url,
      userId,
      planSlug: plan.slug,
      mode,
    };
  }

  async createSubscription(userId: string, plan: Plan): Promise<Subscription> {
    const client = this.requireClient();
    if (plan.interval === "one_time") {
      throw new Error("createSubscription() is for recurring plans only — use createCheckoutSession() for one_time.");
    }
    // Create a customer-less subscription is not allowed by Stripe. We create
    // a customer per user (idempotent by metadata.userId would be ideal; for
    // simplicity here we create one each call and let the caller reconcile).
    const customer = await client.customers.create({
      metadata: { userId },
    });
    const sub = await client.subscriptions.create({
      customer: customer.id,
      items: [{ price: plan.providerPriceId, quantity: 1 }],
      metadata: { userId, planSlug: plan.slug },
    });
    return toSubscription(sub, plan.slug);
  }

  async cancelSubscription(subscriptionId: string, atPeriodEnd = true): Promise<Subscription> {
    const client = this.requireClient();
    if (atPeriodEnd) {
      // Soft-cancel: mark the subscription to expire at the end of the current
      // period. The customer retains access until current_period_end.
      const updated = await client.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
      return toSubscription(updated, updated.metadata?.planSlug ?? "");
    }
    // Hard-cancel: terminate immediately.
    const canceled = await client.subscriptions.cancel(subscriptionId);
    return toSubscription(canceled, canceled.metadata?.planSlug ?? "");
  }

  async getSubscription(subscriptionId: string): Promise<Subscription | null> {
    const client = this.requireClient();
    try {
      const sub = await client.subscriptions.retrieve(subscriptionId);
      const planSlug =
        (sub.metadata?.planSlug as string | undefined) ?? "";
      return toSubscription(sub, planSlug);
    } catch {
      return null;
    }
  }

  /**
   * Verify the webhook signature and parse the event.
   *
   * CRITICAL: we use Stripe's stripe.webhooks.constructEvent() with the
   * PAYMENT_WEBHOOK_SECRET. We never trust ?payment=success query params.
   */
  async processWebhook(rawBody: string | Buffer, signature: string): Promise<WebhookEvent> {
    const client = this.requireClient();
    if (!WEBHOOK_SECRET) {
      throw new Error(
        "PAYMENT_WEBHOOK_SECRET is not set. Stripe webhook signature " +
        "verification is required and cannot be skipped. Set the env var to " +
        "the signing secret from your Stripe webhook endpoint settings."
      );
    }
    const body = typeof rawBody === "string" ? Buffer.from(rawBody) : rawBody;
    // constructEvent throws on signature mismatch — that is the correct
    // behavior: we surface it to the caller so the API route returns 400.
    const event = client.webhooks.constructEvent(
      body,
      signature,
      WEBHOOK_SECRET
    );

    // Normalize a few common event types into our WebhookEvent shape.
    // event.data.object is a discriminated union across every Stripe resource;
    // we coerce to unknown first (per TS guidance) then to the structural shape
    // we actually read.
    const data = event.data.object as unknown as {
      id?: string;
      customer?: string | { id?: string } | null;
      subscription?: string | { id?: string } | null;
      amount_total?: number;
      amount_due?: number;
      amount_paid?: number;
      currency?: string;
      status?: string;
    };

    const amount = data.amount_total ?? data.amount_paid ?? data.amount_due;
    const customer = data.customer;
    const subscription = data.subscription;
    return {
      id: event.id,
      type: event.type,
      subscriptionId:
        typeof subscription === "string"
          ? subscription
          : subscription?.id,
      customerId:
        typeof customer === "string"
          ? customer
          : customer?.id,
      amount: typeof amount === "number" ? amount : undefined,
      currency: typeof data.currency === "string" ? data.currency : undefined,
      status: typeof data.status === "string" ? data.status : undefined,
      raw: event,
    };
  }

  async createCustomerPortalSession(
    customerId: string,
    returnUrl: string
  ): Promise<CustomerPortalSession> {
    const client = this.requireClient();
    const session = await client.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return { id: session.id, url: session.url };
  }

  /** Convenience: get the app URL the factory should default to for returns. */
  static defaultAppUrl(): string {
    return APP_URL || "http://localhost:3000";
  }
}
