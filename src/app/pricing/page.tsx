'use client'

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, Sparkles, Zap, Gauge, ShieldCheck, Layers, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { TOOLS, CATEGORIES } from "@/lib/tool-registry";

const PLANS = [
  {
    slug: "free",
    name: "Free",
    price: 0,
    period: "forever",
    description: "For personal, occasional use.",
    accent: "var(--cat-calculators)",
    features: [
      "Access to all client-side tools",
      `${TOOLS.length}+ working tools`,
      "Up to 10 MB files",
      "20 jobs per day",
      "Standard processing speed",
      "7-day history",
    ],
    notIncluded: ["No batch processing", "No API access", "Ads shown"],
    cta: "Start free",
    href: "/register",
    highlight: false,
  },
  {
    slug: "pro",
    name: "Pro",
    price: 9,
    period: "per month",
    description: "For power users who need more.",
    accent: "var(--cat-video-audio)",
    features: [
      "Everything in Free",
      "Up to 100 MB files",
      "500 jobs per month",
      "Batch processing",
      "OCR access",
      "Priority processing queue",
      "90-day history",
      "No ads",
    ],
    notIncluded: [],
    cta: "Upgrade to Pro",
    href: "/register?plan=pro",
    highlight: true,
  },
  {
    slug: "business",
    name: "Business",
    price: 29,
    period: "per month",
    description: "For teams and API usage.",
    accent: "var(--cat-business)",
    features: [
      "Everything in Pro",
      "Up to 500 MB files",
      "Unlimited jobs",
      "Full API access with API keys",
      "Higher rate limits",
      "Configurable concurrency",
      "365-day history",
      "Team management",
    ],
    notIncluded: [],
    cta: "Start Business",
    href: "/register?plan=business",
    highlight: false,
  },
];

const FAQS = [
  { q: "Can I switch plans anytime?", a: "Yes. Upgrades take effect immediately; downgrades take effect at the next billing cycle. No lock-in." },
  { q: "How is payment handled?", a: "Payments are processed by Stripe. We never see or store your card details. The Stripe webhook is the authoritative source for subscription state." },
  { q: "Do you offer refunds?", a: "If you're not satisfied within the first 14 days of a paid plan, contact support for a full refund." },
  { q: "What happens when I hit my limit?", a: "You'll see a clear message explaining the limit. You can wait for the window to reset, or upgrade. We never silently fail or fake a result." },
  { q: "Is my data private?", a: "Client-side tools run entirely in your browser. Uploaded files are processed server-side, stored with an expiry, and automatically deleted. You can also manually delete files." },
  { q: "Do you support API access?", a: "Yes, on the Business plan. Create API keys in your dashboard and call /api/v1/* endpoints with the same tools available in the web UI." },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 24 }}
        className="hero-mesh glass mb-10 rounded-[2rem] px-6 py-12 text-center sm:px-12 sm:py-16"
      >
        <Badge variant="secondary" className="mb-4 gap-1.5 rounded-full px-3 py-1">
          <Sparkles className="h-3.5 w-3.5" /> Simple, transparent pricing
        </Badge>
        <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          Pay only for what you need.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-lg text-muted-foreground">
          Start free. Upgrade when you need larger files, batch processing, or API access.
          Cancel anytime.
        </p>

        {/* Billing toggle */}
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border bg-background/60 p-1 backdrop-blur">
          <button
            onClick={() => setAnnual(false)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${!annual ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${annual ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            Annual <span className="text-xs opacity-80">(save 20%)</span>
          </button>
        </div>
      </motion.div>

      {/* Plans */}
      <div className="grid gap-5 lg:grid-cols-3">
        {PLANS.map((plan, i) => {
          const price = annual ? Math.round(plan.price * 0.8) : plan.price;
          return (
            <motion.div
              key={plan.slug}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 24, delay: i * 0.08 }}
            >
              <Card
                className={`relative h-full overflow-hidden glass ${plan.highlight ? "border-primary/50 ring-2 ring-primary/20" : ""}`}
              >
                {plan.highlight && (
                  <div className="absolute right-0 top-0 rounded-bl-2xl bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                    Most popular
                  </div>
                )}
                <CardContent className="p-6">
                  <div className="mb-4">
                    <div className="flex items-center gap-2">
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
                        style={{ background: plan.accent }}
                      >
                        {plan.slug === "free" ? <ShieldCheck className="h-4 w-4" /> : plan.slug === "pro" ? <Zap className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
                      </span>
                      <h3 className="text-lg font-semibold">{plan.name}</h3>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
                  </div>

                  <div className="mb-5">
                    <span className="text-4xl font-bold tracking-tight">${price}</span>
                    <span className="text-sm text-muted-foreground"> / {plan.period}</span>
                  </div>

                  <Button
                    asChild
                    variant={plan.highlight ? "default" : "outline"}
                    className="mb-5 w-full pill gap-2"
                  >
                    <Link href={plan.href}>
                      {plan.cta} <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>

                  <ul className="space-y-2.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        <span>{f}</span>
                      </li>
                    ))}
                    {plan.notIncluded.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground line-through">
                        <span className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Why paid */}
      <section className="mt-16">
        <h2 className="mb-6 text-2xl font-bold tracking-tight">Why upgrade?</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: Gauge, color: "var(--cat-image)", title: "Real processing engines", body: "FFmpeg, LibreOffice, Tesseract, Ghostscript and Sharp cost CPU. Paid plans keep them running fast for everyone." },
            { icon: ShieldCheck, color: "var(--cat-business)", title: "Privacy by design", body: "Files expire automatically. No training on your data. Delete anytime." },
            { icon: Zap, color: "var(--cat-developer)", title: "No fake results", body: "Every tool actually works. If a provider is unconfigured, we say so — never silently fail." },
          ].map((f) => (
            <div key={f.title} className="glass rounded-2xl p-6">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: `color-mix(in oklch, ${f.color} 14%, transparent)`, color: f.color }}
              >
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Categories included */}
      <section className="mt-16">
        <h2 className="mb-2 text-2xl font-bold tracking-tight">All {CATEGORIES.length} categories included</h2>
        <p className="mb-6 text-muted-foreground">Every plan has access to every tool. Upgrades just raise limits.</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/category/${c.slug}`}
              style={{ ["--cat-color" as string]: `var(--cat-${c.slug})` }}
              className="group inline-flex items-center gap-2 rounded-full border border-border/40 bg-background/50 px-3 py-1.5 text-sm backdrop-blur transition spring hover:scale-105"
            >
              <span className="h-2 w-2 rounded-full" style={{ background: `var(--cat-${c.slug})` }} />
              {c.name}
            </Link>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-16">
        <h2 className="mb-6 text-2xl font-bold tracking-tight">Frequently asked</h2>
        <div className="glass rounded-2xl p-2">
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((faq, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border-b border-border/40 last:border-0">
                <AccordionTrigger className="px-4 text-left hover:no-underline">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="px-4 text-muted-foreground">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA */}
      <section className="mt-16">
        <div className="hero-mesh glass relative overflow-hidden rounded-[2rem] px-6 py-12 text-center sm:px-12 sm:py-16">
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to start?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Create a free account — no credit card required.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/register">
              <Button size="lg" className="pill gap-2">
                Create free account <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/tools">
              <Button size="lg" variant="outline" className="pill">Browse tools first</Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
