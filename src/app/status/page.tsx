import { getProviderHealth } from "@/lib/providers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle, Database } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Provider status",
  description: "Live integration health for the NexTool platform.",
};

const STATUS_STYLE: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; badge: "default" | "secondary" | "destructive" | "outline" }> = {
  configured: { label: "Configured", icon: CheckCircle2, badge: "default" },
  not_configured: { label: "Not configured", icon: XCircle, badge: "outline" },
  failed: { label: "Failed", icon: AlertTriangle, badge: "destructive" },
};

export default async function StatusPage() {
  const providers = await getProviderHealth();
  const configured = providers.filter((p) => p.status === "configured").length;
  const total = providers.length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Provider status</h1>
        <p className="mt-2 text-muted-foreground">
          Live health of every integration. Nothing is faked — each status is
          the result of a real check.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <Badge variant="default" className="gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> {configured} configured
          </Badge>
          <Badge variant="outline" className="gap-1.5">
            <Database className="h-3.5 w-3.5" /> {total} total
          </Badge>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {providers.map((p) => {
          const s = STATUS_STYLE[p.status];
          const Icon = s.icon;
          return (
            <Card key={p.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <Badge variant={s.badge} className="shrink-0 gap-1.5">
                    <Icon className="h-3.5 w-3.5" /> {s.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{p.detail}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Last checked: {new Date(p.lastChecked).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
        <strong className="text-foreground">Note on the sandbox:</strong> This
        instance runs on SQLite (not PostgreSQL), local filesystem (not S3), and
        in-process job records (not Redis/BullMQ). The architecture is built so
        each can be swapped to its production provider by setting environment
        variables — no code changes required. Processing engines (FFmpeg,
        LibreOffice, Tesseract, Ghostscript, Sharp) are genuinely installed and
        perform real transformations.
      </div>
    </div>
  );
}
