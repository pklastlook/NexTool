'use client'

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Search, Wrench, ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { CATEGORIES, TOOLS } from "@/lib/tool-registry";
import { ToolIcon } from "@/components/tools/tool-icon";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onCommandOpen: () => void;
}

const NAV = [
  { label: "All tools", href: "/tools" },
  { label: "Popular", href: "/tools?filter=popular" },
  { label: "API", href: "/api-docs" },
  { label: "Status", href: "/status" },
];

export function Header({ onCommandOpen }: HeaderProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on route change
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300 spring-smooth",
        scrolled
          ? "glass border-b border-border/40"
          : "border-b border-transparent bg-transparent"
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-3 sm:px-5">
        {/* Logo — gradient brand mark */}
        <Link href="/" className="flex items-center gap-2.5 font-semibold" aria-label="NexTool home">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.55_0.22_255)] to-[oklch(0.62_0.22_300)] text-white shadow-md">
            <Wrench className="h-[18px] w-[18px]" />
          </span>
          <span className="text-[17px] tracking-tight">NexTool</span>
        </Link>

        {/* Desktop nav — mega menu */}
        <div className="ml-3 hidden md:block">
          <NavigationMenu>
            <NavigationMenuList>
              {/* Categories mega menu */}
              <NavigationMenuItem>
                <NavigationMenuTrigger className="rounded-full">Categories</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="glass w-[760px] rounded-3xl p-4">
                    <div className="mb-3 flex items-center justify-between px-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Browse {CATEGORIES.length} categories · {TOOLS.length}+ tools
                      </span>
                      <Link href="/tools" className="text-xs font-medium text-primary hover:underline">
                        View all tools →
                      </Link>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3">
                      {CATEGORIES.map((c) => {
                        const count = TOOLS.filter((t) => t.category === c.slug).length;
                        return (
                          <NavigationMenuLink asChild key={c.slug}>
                            <Link
                              href={`/category/${c.slug}`}
                              style={{ ["--cat-color" as string]: `var(--cat-${c.slug})` }}
                              className="group flex items-start gap-3 rounded-2xl border border-transparent p-3 transition spring-smooth hover:border-border/40 hover:bg-foreground/[0.03]"
                            >
                              <span
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition spring group-hover:scale-110"
                                style={{
                                  background: `var(--cat-${c.slug})`,
                                  color: "white",
                                }}
                              >
                                <ToolIcon name={c.icon} className="h-[18px] w-[18px]" />
                              </span>
                              <span className="min-w-0">
                                <span className="block text-sm font-medium">{c.name}</span>
                                <span className="block text-xs text-muted-foreground line-clamp-1">
                                  {c.description}
                                </span>
                                <span
                                  className="mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium"
                                  style={{
                                    background: `color-mix(in oklch, var(--cat-${c.slug}) 12%, transparent)`,
                                    color: `var(--cat-${c.slug})`,
                                  }}
                                >
                                  {count} tools
                                </span>
                              </span>
                            </Link>
                          </NavigationMenuLink>
                        );
                      })}
                    </div>
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>

              {/* Flat nav items */}
              {NAV.map((item) => (
                <NavigationMenuItem key={item.href}>
                  <Link href={item.href} legacyBehavior passHref>
                    <NavigationMenuLink className={cn(navigationMenuTriggerStyle(), "rounded-full")}>
                      {item.label}
                    </NavigationMenuLink>
                  </Link>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Command search — Spotlight style */}
          <button
            onClick={onCommandOpen}
            className="group hidden h-9 items-center gap-2 rounded-full border border-border/50 bg-background/50 px-3.5 text-sm text-muted-foreground backdrop-blur transition spring-smooth hover:border-border hover:bg-background/70 hover:text-foreground sm:inline-flex"
            aria-label="Open command search"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span>Search…</span>
            <kbd className="ml-1 rounded border border-border/60 bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium">
              ⌘K
            </kbd>
          </button>

          {/* Mobile search icon */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onCommandOpen}
            className="rounded-full sm:hidden"
            aria-label="Search"
          >
            <Search className="h-[18px] w-[18px]" />
          </Button>

          <ThemeToggle />
          <UserMenu />

          {/* Mobile menu trigger */}
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile menu — glass dropdown */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="glass overflow-hidden border-t border-border/40 md:hidden"
          >
            <div className="max-h-[70vh] space-y-1 overflow-y-auto px-3 py-3">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-foreground/5"
                >
                  {item.label}
                </Link>
              ))}
              <div className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Categories
              </div>
              <div className="grid grid-cols-2 gap-1">
                {CATEGORIES.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/category/${c.slug}`}
                    style={{ ["--cat-color" as string]: `var(--cat-${c.slug})` }}
                    className="group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-foreground/5"
                  >
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-white transition group-hover:scale-110"
                      style={{ background: `var(--cat-${c.slug})` }}
                    >
                      <ToolIcon name={c.icon} className="h-4 w-4" />
                    </span>
                    <span className="truncate">{c.name}</span>
                  </Link>
                ))}
              </div>
              <Link
                href="/pricing"
                className="mt-2 block rounded-2xl bg-gradient-to-br from-[oklch(0.55_0.22_255)] to-[oklch(0.62_0.22_300)] p-4 text-white"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-sm font-semibold">Go Pro</span>
                </div>
                <p className="mt-1 text-xs text-white/80">Larger files, batch processing & priority.</p>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
