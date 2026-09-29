'use client'

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Menu, Search, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { cn } from "@/lib/utils";

interface TopBarProps {
  onCommandOpen: () => void;
  onSidebarToggle: () => void;
}

export function TopBar({ onCommandOpen, onSidebarToggle }: TopBarProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 w-full transition-all duration-300 spring-smooth",
        scrolled
          ? "glass border-b border-border/40"
          : "border-b border-transparent bg-transparent"
      )}
    >
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-2 px-3 sm:px-4">
        {/* Sidebar toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onSidebarToggle}
          className="rounded-full"
          aria-label="Toggle sidebar"
        >
          <PanelLeft className="h-[18px] w-[18px]" />
        </Button>

        {/* Command search — macOS Spotlight style */}
        <button
          onClick={onCommandOpen}
          className="group flex h-9 flex-1 items-center gap-2.5 rounded-full border border-border/50 bg-background/50 px-3.5 text-sm text-muted-foreground backdrop-blur transition spring-smooth hover:border-border hover:bg-background/70 hover:text-foreground max-w-md"
          aria-label="Open command search"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Search tools…</span>
          <span className="sm:hidden">Search</span>
          <kbd className="ml-auto hidden items-center gap-0.5 rounded border border-border/60 bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium sm:inline-flex">
            ⌘K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
