'use client'

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Search, ArrowRight, Sparkles, ShieldCheck, Zap, Gauge, Layers, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CATEGORIES, TOOLS, popularTools, featuredTools } from "@/lib/tool-registry";
import { ToolIcon } from "@/components/tools/tool-icon";

const QUICK_ACTIONS = [
  { label: "Compress PDF", slug: "compress-pdf", color: "pdf" },
  { label: "Convert Image", slug: "image-converter", color: "image" },
  { label: "Create Invoice", slug: "invoice-generator", color: "documents" },
  { label: "Word to PDF", slug: "word-to-pdf", color: "office" },
  { label: "Generate QR", slug: "qr-generator", color: "qr-barcode" },
  { label: "Calculate Profit", slug: "profit-margin-calculator", color: "business" },
] as const;

const STATS = [
  { icon: Layers, value: `${TOOLS.length}+`, label: "Real working tools", color: "var(--cat-calculators)" },
  { icon: Gauge, value: `${CATEGORIES.length}`, label: "Categories", color: "var(--cat-developer)" },
  { icon: Zap, value: "100%", label: "Genuine processing", color: "var(--cat-image)" },
  { icon: ShieldCheck, value: "0", label: "Fake results", color: "var(--cat-business)" },
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
    <div className="space-y-16 px-1 py-6 sm:py-8">
      {/* ---------- Hero ---------- */}
      <section className="relative">
        <div className="hero-mesh glass relative overflow-hidden rounded-[2rem] px-6 py-12 sm:px-12 sm:py-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 24 }}
            className="mx-auto max-w-2xl text-center"
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

            {/* Spotlight-style search */}
            <div className="relative mx-auto mt-8 max-w-xl">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="What do you need to do?"
                  className="glass h-14 rounded-2xl border-border/40 pl-12 pr-4 text-base shadow-sm"
                  aria-label="Search tools"
                />
              </div>
              {liveResults.length > 0 && (
                <div className="glass absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-border/40">
                  {liveResults.map((t) => (
                    <Link
                      key={t.slug}
                      href={`/tools/${t.slug}`}
                      className="flex items-center gap-3 border-b border-border/40 px-4 py-2.5 last:border-0 hover:bg-foreground/5"
                      style={{ ["--cat-color" as string]: `var(--cat-${t.category})` }}
                    >
                      <span className="accent-cat flex h-8 w-8 items-center justify-center rounded-lg">
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

            {/* Quick actions — colored pills */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {QUICK_ACTIONS.map((a) => (
                <Link key={a.slug} href={`/tools/${a.slug}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="pill gap-2 border-border/50 bg-background/50 backdrop-blur hover:scale-105 spring"
                    style={{ ["--cat-color" as string]: `var(--cat-${a.color})` }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: `var(--cat-${a.color})` }} />
                    {a.label}
                  </Button>
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Stats strip */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 24, delay: 0.1 }}
            className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4"
          >
            {STATS.map((s) => (
              <div key={s.label} className="glass rounded-2xl p-4 text-center">
                <s.icon className="mx-auto h-5 w-5" style={{ color: s.color }} />
                <div className="mt-2 text-2xl font-semibold tracking-tight">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ---------- Popular tools ---------- */}
      <section>
        <SectionHeader
          eyebrow="Most used"
          title="Popular tools"
          action={<Link href="/tools?filter=popular"><Button variant="ghost" size="sm" className="pill gap-1">View all <ArrowRight className="h-4 w-4" /></Button></Link>}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {popularTools(8).map((t, i) => (
            <ToolCard key={t.slug} tool={t} index={i} />
          ))}
        </div>
      </section>

      {/* ---------- Categories — colorful tiles ---------- */}
      <section>
        <SectionHeader eyebrow="Browse" title="Explore by category" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {CATEGORIES.map((c, i) => (
            <motion.div
              key={c.slug}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ type: "spring", stiffness: 260, damping: 24, delay: Math.min(i * 0.03, 0.3) }}
            >
              <Link
                href={`/category/${c.slug}`}
                className="group flex h-full flex-col gap-3 rounded-2xl glass p-5 transition spring hover:-translate-y-1 hover:shadow-lg"
                style={{ ["--cat-color" as string]: `var(--cat-${c.slug})` }}
              >
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-xl transition spring group-hover:scale-110"
                  style={{
                    background: `var(--cat-${c.slug})`,
                    color: "white",
                  }}
                >
                  <ToolIcon name={c.icon} className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-medium leading-tight">{c.name}</div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{c.description}</div>
                </div>
                <div className="mt-auto flex items-center gap-1.5 text-xs">
                  <span
                    className="rounded-full px-2 py-0.5 font-medium"
                    style={{
                      background: `color-mix(in oklch, var(--cat-${c.slug}) 12%, transparent)`,
                      color: `var(--cat-${c.slug})`,
                    }}
                  >
                    {TOOLS.filter((t) => t.category === c.slug).length} tools
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---------- Featured tools ---------- */}
      <section>
        <SectionHeader
          eyebrow="Editor's pick"
          title="Featured tools"
          action={<Link href="/tools"><Button variant="ghost" size="sm" className="pill gap-1">All tools <ArrowRight className="h-4 w-4" /></Button></Link>}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featuredTools(6).map((t, i) => (
            <ToolCard key={t.slug} tool={t} index={i} featured />
          ))}
        </div>
      </section>

      {/* ---------- Why use us ---------- */}
      <section>
        <SectionHeader eyebrow="Why NexTool" title="Built to be genuinely useful" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Zap, color: "var(--cat-image)", title: "Real processing", body: "FFmpeg, LibreOffice, Tesseract, Ghostscript and Sharp power real file transformations — no fakes." },
            { icon: ShieldCheck, color: "var(--cat-business)", title: "Privacy first", body: "Client-side tools run entirely in your browser. Files are processed and expired automatically." },
            { icon: Gauge, color: "var(--cat-developer)", title: "Fast & premium", body: "A refined, responsive interface with command search, dark mode and accessibility built in." },
            { icon: Layers, color: "var(--cat-office)", title: "Provider-agnostic", body: "Storage, payments, email and AI sit behind clean interfaces — swap providers without rewriting the app." },
            { icon: Wand2, color: "var(--cat-qr-barcode)", title: "74+ working tools", body: "From PDF and images to OCR, Office, QR and developer utilities — each one actually works." },
            { icon: Sparkles, color: "var(--cat-video-audio)", title: "Honest status", body: "Provider health is checked for real and reported accurately. Nothing is silently 'connected'." },
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

      {/* ---------- CTA ---------- */}
      <section>
        <div className="hero-mesh glass relative overflow-hidden rounded-[2rem] px-6 py-12 text-center sm:px-12 sm:py-16">
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you need. Nothing that doesn&apos;t work.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Browse all {TOOLS.length} tools or jump straight to a category.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/tools">
              <Button size="lg" className="pill gap-2">
                Browse all tools <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/status">
              <Button size="lg" variant="outline" className="pill">Provider status</Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
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
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ type: "spring", stiffness: 260, damping: 24, delay: Math.min(index * 0.04, 0.3) }}
    >
      <Link
        href={`/tools/${tool.slug}`}
        className="group flex h-full flex-col gap-3 rounded-2xl glass p-5 transition spring hover:-translate-y-1 hover:shadow-lg"
        style={{ ["--cat-color" as string]: `var(--cat-${tool.category})` }}
      >
        <div className="flex items-start justify-between">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-xl transition spring group-hover:scale-110"
            style={{
              background: `color-mix(in oklch, var(--cat-${tool.category}) 14%, transparent)`,
              color: `var(--cat-${tool.category})`,
            }}
          >
            <ToolIcon name={tool.icon} className="h-5 w-5" />
          </span>
          {featured && (
            <Badge variant="secondary" className="pill gap-1">
              <Sparkles className="h-3 w-3" /> Featured
            </Badge>
          )}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold leading-tight">{tool.name}</h3>
          <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{tool.description}</p>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span
            className="rounded-full px-2 py-0.5 font-medium capitalize"
            style={{
              background: `color-mix(in oklch, var(--cat-${tool.category}) 10%, transparent)`,
              color: `var(--cat-${tool.category})`,
            }}
          >
            {tool.category.replace("-", " ")}
          </span>
          <span className="inline-flex items-center gap-1 text-muted-foreground transition group-hover:text-foreground">
            Open <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
