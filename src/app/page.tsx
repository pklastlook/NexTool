'use client'

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Search, ArrowRight, Sparkles, ShieldCheck, Zap, Gauge, Layers,
  FileText, Image as ImageIcon, FileType2, Code2, QrCode, Calculator,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CATEGORIES, TOOLS, popularTools, featuredTools,
} from "@/lib/tool-registry";
import { ToolIcon } from "@/components/tools/tool-icon";

const QUICK_ACTIONS = [
  { label: "Compress PDF", slug: "compress-pdf" },
  { label: "Convert Image", slug: "image-converter" },
  { label: "Create Invoice", slug: "invoice-generator" },
  { label: "Word to PDF", slug: "word-to-pdf" },
  { label: "Generate QR", slug: "qr-generator" },
  { label: "Calculate Profit", slug: "profit-margin-calculator" },
];

const STATS = [
  { icon: Layers, value: `${TOOLS.length}+`, label: "Real working tools" },
  { icon: Gauge, value: "13", label: "Categories" },
  { icon: Zap, value: "100%", label: "Genuine processing" },
  { icon: ShieldCheck, value: "0", label: "Fake results" },
];

export default function HomePage() {
  const [query, setQuery] = useState("");

  const liveResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return TOOLS.filter((t) =>
      [t.name, t.description, ...t.keywords, t.category].join(" ").toLowerCase().includes(q)
    ).slice(0, 6);
  }, [query]);

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden hero-mesh">
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-16 sm:px-6 sm:pb-24 sm:pt-24">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-3xl text-center"
          >
            <Badge variant="secondary" className="mb-5 gap-1.5 rounded-full px-3 py-1">
              <Sparkles className="h-3.5 w-3.5" />
              Premium all-in-one tools platform
            </Badge>
            <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-6xl">
              Powerful tools for everyday work.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-lg text-muted-foreground">
              Convert, compress, create, calculate and simplify — all in one
              place. Every tool actually works.
            </p>

            {/* Search */}
            <div className="relative mx-auto mt-8 max-w-xl">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="What do you need to do?"
                  className="h-14 rounded-2xl border-border/60 bg-background/70 pl-12 pr-4 text-base shadow-sm backdrop-blur"
                  aria-label="Search tools"
                />
              </div>
              {liveResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border bg-popover shadow-lg">
                  {liveResults.map((t) => (
                    <Link
                      key={t.slug}
                      href={`/tools/${t.slug}`}
                      className="flex items-center gap-3 border-b px-4 py-2.5 last:border-0 hover:bg-accent"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <ToolIcon name={t.icon} className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{t.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{t.description}</div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {QUICK_ACTIONS.map((a) => (
                <Link key={a.slug} href={`/tools/${a.slug}`}>
                  <Button variant="outline" size="sm" className="rounded-full">
                    {a.label}
                  </Button>
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Stats strip */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4"
          >
            {STATS.map((s) => (
              <div key={s.label} className="glass-surface rounded-2xl p-4 text-center">
                <s.icon className="mx-auto h-5 w-5 text-primary" />
                <div className="mt-2 text-2xl font-semibold tracking-tight">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ---------- Popular tools ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <SectionHeader
          eyebrow="Most used"
          title="Popular tools"
          action={<Link href="/tools?filter=popular"><Button variant="ghost" size="sm" className="gap-1">View all <ArrowRight className="h-4 w-4" /></Button></Link>}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {popularTools(8).map((t, i) => (
            <ToolCard key={t.slug} tool={t} index={i} />
          ))}
        </div>
      </section>

      {/* ---------- Categories ---------- */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
          <SectionHeader eyebrow="Browse" title="Explore by category" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {CATEGORIES.map((c, i) => (
              <motion.div
                key={c.slug}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
              >
                <Link
                  href={`/category/${c.slug}`}
                  className="group flex h-full flex-col gap-3 rounded-2xl border bg-card p-5 transition hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md elevated-card"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground transition group-hover:scale-105">
                    <ToolIcon name={c.icon} className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{c.description}</div>
                  </div>
                  <div className="mt-auto text-xs text-muted-foreground">
                    {TOOLS.filter((t) => t.category === c.slug).length} tools
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Featured tools ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <SectionHeader
          eyebrow="Editor's pick"
          title="Featured tools"
          action={<Link href="/tools"><Button variant="ghost" size="sm" className="gap-1">All tools <ArrowRight className="h-4 w-4" /></Button></Link>}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featuredTools(6).map((t, i) => (
            <ToolCard key={t.slug} tool={t} index={i} featured />
          ))}
        </div>
      </section>

      {/* ---------- Why use us ---------- */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
          <SectionHeader eyebrow="Why NexTool" title="Built to be genuinely useful" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Zap, title: "Real processing", body: "FFmpeg, LibreOffice, Tesseract, Ghostscript and Sharp power real file transformations — no fakes." },
              { icon: ShieldCheck, title: "Privacy first", body: "Client-side tools run entirely in your browser. Files are processed and expired automatically." },
              { icon: Gauge, title: "Fast & premium", body: "A refined, responsive interface with command search, dark mode and accessibility built in." },
              { icon: Layers, title: "Provider-agnostic", body: "Storage, payments, email and AI sit behind clean interfaces — swap providers without rewriting the app." },
              { icon: FileText, title: "73+ working tools", body: "From PDF and images to OCR, Office, QR and developer utilities — each one actually works." },
              { icon: Sparkles, title: "Honest status", body: "Provider health is checked for real and reported accurately. Nothing is silently 'connected'." },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl border bg-card p-6 elevated-card">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="glass-surface relative overflow-hidden rounded-3xl px-6 py-12 text-center sm:px-12 sm:py-16">
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you need. Nothing that doesn&apos;t work.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Browse all {TOOLS.length} tools or jump straight to a category.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/tools">
              <Button size="lg" className="gap-2 rounded-full">
                Browse all tools <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/status">
              <Button size="lg" variant="outline" className="rounded-full">
                Provider status
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function SectionHeader({
  eyebrow, title, action,
}: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{eyebrow}</div>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function ToolCard({ tool, index, featured }: { tool: typeof TOOLS[number]; index: number; featured?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.3) }}
    >
      <Link
        href={`/tools/${tool.slug}`}
        className="group flex h-full flex-col gap-3 rounded-2xl border bg-card p-5 transition hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md elevated-card"
      >
        <div className="flex items-start justify-between">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground transition group-hover:scale-105">
            <ToolIcon name={tool.icon} className="h-5 w-5" />
          </span>
          {featured && (
            <Badge variant="secondary" className="gap-1 rounded-full">
              <Sparkles className="h-3 w-3" /> Featured
            </Badge>
          )}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold leading-tight">{tool.name}</h3>
          <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{tool.description}</p>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="capitalize">{tool.category.replace("-", " ")}</span>
          <span className="inline-flex items-center gap-1 transition group-hover:text-foreground">
            Open <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
