"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Plug,
  ServerCog,
  ListChecks,
  BarChart3,
  Settings,
  ShieldAlert,
} from "lucide-react";

import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/integrations", label: "Integrations", icon: Plug },
  { href: "/admin/workers", label: "Workers", icon: ServerCog },
  { href: "/admin/jobs", label: "Jobs", icon: ListChecks },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminNav() {
  const pathname = usePathname() || "/admin";

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 md:border-r bg-muted/30">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <div className="size-7 rounded-md bg-primary text-primary-foreground grid place-items-center text-xs font-bold">
            N
          </div>
          <div className="text-sm font-semibold leading-tight">
            NexTool
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Admin Console
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          <ul className="space-y-0.5">
            {NAV.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                      active
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t p-3">
          <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 p-2.5 text-xs text-amber-800 dark:text-amber-300">
            <ShieldAlert className="size-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">ADMIN — no auth gate</div>
              <div className="mt-0.5 text-[11px] opacity-80">
                Sandbox mode. Production will require admin auth.
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile top nav */}
      <div className="md:hidden sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="flex h-12 items-center gap-2 px-3">
          <div className="size-6 rounded-md bg-primary text-primary-foreground grid place-items-center text-[10px] font-bold">
            N
          </div>
          <span className="text-sm font-semibold">Admin</span>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/40 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-300">
            <ShieldAlert className="size-3" /> no auth
          </span>
        </div>
        <div className="flex gap-1 overflow-x-auto px-2 pb-2">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs whitespace-nowrap transition-colors",
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
