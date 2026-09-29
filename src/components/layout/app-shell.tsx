'use client'

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { Footer } from "@/components/layout/footer";
import { CommandPalette } from "@/components/layout/command-palette";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [commandOpen, setCommandOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();

  // On mobile (md and below) the sidebar starts closed
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [pathname]);

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
        <TopBar
          onCommandOpen={() => setCommandOpen(true)}
          onSidebarToggle={() => setSidebarOpen((v) => !v)}
        />
        <div className="mx-auto flex w-full max-w-[1400px] flex-1 gap-3 px-3 pb-3 sm:px-4 sm:pb-4">
          {/* Sidebar (floating glass) */}
          <div className="hidden md:block">
            <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
          </div>
          {/* Mobile sidebar (overlay) */}
          <div className="md:hidden">
            <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
          </div>

          {/* Main content */}
          <main className="min-w-0 flex-1">
            {children}
          </main>
        </div>
        <Footer />
        <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      </div>
    </SessionProvider>
  );
}
