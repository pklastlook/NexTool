'use client'

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Wrench, X, ChevronRight, Sparkles, LayoutGrid, Activity, FileText } from "lucide-react";
import { CATEGORIES } from "@/lib/tool-registry";
import { ToolIcon } from "@/components/tools/tool-icon";
import { cn } from "@/lib/utils";

interface SidebarProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const NAV = [
  { label: "Home", href: "/", icon: "Home" },
  { label: "All tools", href: "/tools", icon: "LayoutGrid" },
  { label: "Popular", href: "/tools?filter=popular", icon: "Sparkles" },
  { label: "Provider status", href: "/status", icon: "Activity" },
  { label: "API docs", href: "/api-docs", icon: "FileText" },
];

export function Sidebar({ open, onOpenChange }: SidebarProps) {
  const pathname = usePathname();
  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href.split("?")[0]) && (href.split("/").length > 1 ? pathname === href.split("?")[0] : false);
  };

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar — floating glass panel like macOS Finder */}
      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ x: -320, opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0.6 }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className="glass-heavy fixed inset-y-3 left-3 z-50 flex w-[270px] flex-col overflow-hidden rounded-3xl md:static md:inset-auto md:z-auto md:flex md:rounded-3xl"
          >
            {/* Header / logo */}
            <div className="flex items-center justify-between px-5 pb-3 pt-5">
              <Link href="/" className="flex items-center gap-2.5" onClick={() => onOpenChange(false)}>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.55_0.22_255)] to-[oklch(0.62_0.22_300)] text-white shadow-md">
                  <Wrench className="h-[18px] w-[18px]" />
                </span>
                <div className="leading-tight">
                  <div className="text-[15px] font-semibold tracking-tight">NexTool</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Tools platform</div>
                </div>
              </Link>
              <button
                onClick={() => onOpenChange(false)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-foreground/5 md:hidden"
                aria-label="Close sidebar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable nav */}
            <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label="Main navigation">
              {/* Primary nav */}
              <div className="mb-4">
                <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Navigate
                </div>
                <ul className="space-y-0.5">
                  {NAV.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => onOpenChange(false)}
                          className={cn(
                            "group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition spring-smooth",
                            active
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-foreground/80 hover:bg-foreground/5 hover:text-foreground"
                          )}
                        >
                          <ToolIcon name={item.icon} className={cn("h-[18px] w-[18px]", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                          <span>{item.label}</span>
                          {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Categories */}
              <div>
                <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Categories
                </div>
                <ul className="space-y-0.5">
                  {CATEGORIES.map((c) => {
                    const active = pathname === `/category/${c.slug}`;
                    return (
                      <li key={c.slug}>
                        <Link
                          href={`/category/${c.slug}`}
                          onClick={() => onOpenChange(false)}
                          className={cn(
                            "group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition spring-smooth",
                            active
                              ? "bg-foreground/5 font-medium"
                              : "text-foreground/80 hover:bg-foreground/5 hover:text-foreground"
                          )}
                          style={{ ["--cat-color" as string]: `var(--cat-${c.slug})` }}
                        >
                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition spring-smooth group-hover:scale-105"
                            style={{
                              background: active ? `var(--cat-${c.slug})` : `color-mix(in oklch, var(--cat-${c.slug}) 14%, transparent)`,
                              color: active ? "white" : `var(--cat-${c.slug})`,
                            }}
                          >
                            <ToolIcon name={c.icon} className="h-[15px] w-[15px]" />
                          </span>
                          <span className="truncate">{c.name}</span>
                          {active && <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </nav>

            {/* Footer card — pricing CTA */}
            <div className="border-t border-border/40 p-3">
              <Link
                href="/pricing"
                onClick={() => onOpenChange(false)}
                className="block rounded-2xl bg-gradient-to-br from-[oklch(0.55_0.22_255)] to-[oklch(0.62_0.22_300)] p-4 text-white shadow-md transition spring hover:scale-[1.02] hover:shadow-lg"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-sm font-semibold">Go Pro</span>
                </div>
                <p className="mt-1 text-xs text-white/80">Unlock larger files, batch processing & priority.</p>
              </Link>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
