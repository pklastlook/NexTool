'use client'

import { useEffect, useState } from "react";
import { SessionProvider } from "next-auth/react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CommandPalette } from "@/components/layout/command-palette";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [commandOpen, setCommandOpen] = useState(false);

  // Global ⌘K shortcut for command palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <SessionProvider>
      <div className="ambient-texture flex min-h-screen flex-col">
        <Header onCommandOpen={() => setCommandOpen(true)} />
        <main className="flex-1">
          {children}
        </main>
        <Footer />
        <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      </div>
    </SessionProvider>
  );
}
