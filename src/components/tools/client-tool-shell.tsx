'use client'

import { Card, CardContent } from "@/components/ui/card";

/**
 * Shared shell for client-side tool UIs.
 * Provides consistent card padding and layout.
 */
export function ClientToolShell({ children }: { children: React.ReactNode }) {
  return (
    <Card className="elevated-card">
      <CardContent className="p-5 sm:p-6">{children}</CardContent>
    </Card>
  );
}

export function ToolField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
