'use client'

import Link from "next/link";
import { Wrench, Github, Heart } from "lucide-react";
import { CATEGORIES } from "@/lib/tool-registry";
import { ToolIcon } from "@/components/tools/tool-icon";

export function Footer() {
  return (
    <footer className="mt-auto px-3 pb-4 sm:px-4">
      <div className="glass mx-auto max-w-[1400px] rounded-3xl px-6 py-8 sm:px-10">
        <div className="grid gap-8 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Link href="/" className="flex items-center gap-2.5 font-semibold">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.55_0.22_255)] to-[oklch(0.62_0.22_300)] text-white shadow-md">
                <Wrench className="h-4 w-4" />
              </span>
              <span>NexTool</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Powerful tools for everyday work. Convert, compress, create and
              simplify — all in one place. Every tool actually works.
            </p>
            <div className="mt-4 flex items-center gap-3 text-muted-foreground">
              <a
                href="https://github.com/pklastlook/NexTool"
                target="_blank"
                rel="noreferrer"
                className="transition hover:text-foreground"
                aria-label="GitHub repository"
              >
                <Github className="h-4 w-4" />
              </a>
            </div>
          </div>

          <FooterCol title="Categories" links={CATEGORIES.slice(0, 6).map((c) => ({ label: c.name, href: `/category/${c.slug}` }))} />
          <FooterCol title="More categories" links={CATEGORIES.slice(6).map((c) => ({ label: c.name, href: `/category/${c.slug}` }))} />
          <FooterCol
            title="Platform"
            links={[
              { label: "All tools", href: "/tools" },
              { label: "Popular tools", href: "/tools?filter=popular" },
              { label: "Provider status", href: "/status" },
              { label: "Pricing", href: "/pricing" },
              { label: "API docs", href: "/api-docs" },
              { label: "Admin", href: "/admin" },
            ]}
          />
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-border/40 pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} NexTool. Built as a real, working tools platform.</p>
          <p className="inline-flex items-center gap-1.5">
            Crafted with <Heart className="h-3 w-3 fill-current text-rose-500" /> macOS Tahoe-inspired design
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.href + l.label}>
            <Link href={l.href} className="text-sm text-muted-foreground transition hover:text-foreground">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
