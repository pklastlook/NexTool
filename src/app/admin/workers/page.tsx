import { db } from "@/lib/db";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ServerCog, Circle, Activity } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Workers",
};

/**
 * Compute the effective worker status.
 *
 * The DB-stored `status` field is the worker's last self-reported state.
 * If the heartbeat is stale (> 30s) we override the badge color to
 * "degraded" so operators see dead-but-not-yet-cleaned-up workers.
 */
function effectiveStatus(
  stored: string,
  lastHeartbeat: Date | null
): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  if (stored === "offline") {
    return { label: "offline", variant: "secondary" };
  }
  if (!lastHeartbeat) {
    return { label: "no heartbeat", variant: "destructive" };
  }
  const ageMs = Date.now() - lastHeartbeat.getTime();
  const staleMs = 30_000;
  if (ageMs > staleMs) {
    return { label: "degraded", variant: "destructive" };
  }
  switch (stored) {
    case "healthy":
      return { label: "healthy", variant: "default" };
    case "busy":
      return { label: "busy", variant: "default" };
    case "idle":
      return { label: "idle", variant: "outline" };
    case "degraded":
      return { label: "degraded", variant: "destructive" };
    default:
      return { label: stored, variant: "secondary" };
  }
}

function relativeTime(d: Date | null): string {
  if (!d) return "never";
  const ms = Date.now() - d.getTime();
  if (ms < 5_000) return "just now";
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

export default async function WorkersPage() {
  const workers = await db.worker.findMany({
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 200,
  });

  const counts = {
    healthy: workers.filter((w) => effectiveStatus(w.status, w.lastHeartbeat).label === "healthy").length,
    busy: workers.filter((w) => effectiveStatus(w.status, w.lastHeartbeat).label === "busy").length,
    idle: workers.filter((w) => effectiveStatus(w.status, w.lastHeartbeat).label === "idle").length,
    degraded: workers.filter((w) => effectiveStatus(w.status, w.lastHeartbeat).label === "degraded").length,
    offline: workers.filter((w) => effectiveStatus(w.status, w.lastHeartbeat).label === "offline").length,
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Workers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Background worker processes registered in the system. Heartbeats older than 30s are
          highlighted as degraded.
        </p>
      </header>

      <section className="grid gap-3 grid-cols-2 md:grid-cols-5">
        <KpiTile label="Healthy" value={counts.healthy} dot="emerald" />
        <KpiTile label="Busy" value={counts.busy} dot="blue" />
        <KpiTile label="Idle" value={counts.idle} dot="slate" />
        <KpiTile label="Degraded" value={counts.degraded} dot="red" />
        <KpiTile label="Offline" value={counts.offline} dot="gray" />
      </section>

      <Card className="py-0 overflow-hidden">
        <CardHeader className="border-b py-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">All workers</CardTitle>
            <Badge variant="outline" className="gap-1">
              <ServerCog className="size-3.5" /> {workers.length} total
            </Badge>
          </div>
          <CardDescription className="text-xs">
            In the sandbox, processing runs in-band and no persistent workers are registered —
            this list will be empty by default. Production deploys would register worker
            processes via heartbeat here.
          </CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Worker ID</TableHead>
              <TableHead>Queue</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last heartbeat</TableHead>
              <TableHead>Current job</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Started</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                  <Activity className="size-5 mx-auto mb-2 opacity-40" />
                  No workers registered. Jobs are processed in-process in this sandbox.
                </TableCell>
              </TableRow>
            ) : (
              workers.map((w) => {
                const eff = effectiveStatus(w.status, w.lastHeartbeat);
                return (
                  <TableRow key={w.id}>
                    <TableCell className="font-mono text-xs">{w.workerId}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px]">{w.queue}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={eff.variant} className="gap-1">
                        <Circle className="size-2 fill-current" />
                        {eff.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-muted-foreground">
                      {relativeTime(w.lastHeartbeat)}
                    </TableCell>
                    <TableCell className="font-mono text-[10px] text-muted-foreground">
                      {w.currentJobId ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {w.version ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {w.startedAt ? new Date(w.startedAt).toLocaleString() : "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function KpiTile({
  label,
  value,
  dot,
}: {
  label: string;
  value: number;
  dot: "emerald" | "blue" | "slate" | "red" | "gray";
}) {
  const dotColor: Record<typeof dot, string> = {
    emerald: "bg-emerald-500",
    blue: "bg-blue-500",
    slate: "bg-slate-400",
    red: "bg-red-500",
    gray: "bg-gray-400",
  };
  return (
    <Card className="py-4">
      <CardContent className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold tabular-nums">{value}</div>
        </div>
        <span className={`size-2.5 rounded-full ${dotColor[dot]}`} />
      </CardContent>
    </Card>
  );
}
