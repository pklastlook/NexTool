import Link from "next/link";
import { db } from "@/lib/db";
import { getProviderHealth } from "@/lib/providers";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  ListChecks,
  CheckCircle2,
  XCircle,
  Server,
  Clock,
  Activity,
  ArrowRight,
  Plug,
  BarChart3,
} from "lucide-react";
import { ProviderStatusBadge } from "@/components/admin/provider-status-badge";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Overview",
};

function startOfTodayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function durationMs(startedAt: Date | null, completedAt: Date | null): number | null {
  if (!startedAt || !completedAt) return null;
  return completedAt.getTime() - startedAt.getTime();
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

const JOB_STATUS_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  completed: "default",
  failed: "destructive",
  cancelled: "secondary",
  processing: "secondary",
  queued: "outline",
  created: "outline",
  validating: "outline",
  scanning: "outline",
  validating_output: "outline",
  expired: "secondary",
};

export default async function AdminHomePage() {
  // Real KPI queries — no fabricated metrics.
  const todayStart = startOfTodayUtc();

  const [
    totalUsers,
    jobsTodayAgg,
    completedTodayAgg,
    failedTodayAgg,
    queuedCount,
    activeWorkers,
    recentJobs,
    providers,
  ] = await Promise.all([
    db.user.count(),
    db.processingJob.aggregate({ where: { createdAt: { gte: todayStart } }, _count: true }),
    db.processingJob.aggregate({
      where: { createdAt: { gte: todayStart }, status: "completed" },
      _count: true,
    }),
    db.processingJob.aggregate({
      where: { createdAt: { gte: todayStart }, status: "failed" },
      _count: true,
    }),
    db.processingJob.count({ where: { status: { in: ["queued", "created", "validating", "scanning", "processing", "validating_output"] } } }),
    db.worker.count({ where: { status: { in: ["healthy", "busy", "idle"] } } }),
    db.processingJob.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
      include: { tool: true, user: true },
    }),
    getProviderHealth(),
  ]);

  const configuredProviders = providers.filter((p) => p.status === "configured").length;
  const failedProviders = providers.filter((p) => p.status === "failed").length;

  const kpis = [
    { label: "Total users", value: totalUsers, icon: Users, hint: "All registered accounts" },
    { label: "Jobs today", value: jobsTodayAgg._count, icon: ListChecks, hint: "Created since 00:00 UTC" },
    { label: "Completed today", value: completedTodayAgg._count, icon: CheckCircle2, hint: "Successfully finished" },
    { label: "Failed today", value: failedTodayAgg._count, icon: XCircle, hint: "Terminal failures" },
    { label: "Queued / active", value: queuedCount, icon: Clock, hint: "Awaiting or in-flight" },
    { label: "Active workers", value: activeWorkers, icon: Server, hint: "Online worker processes" },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Admin overview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Live operational snapshot. All metrics are real DB queries.
        </p>
      </header>

      {/* KPIs */}
      <section className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="py-4">
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-medium uppercase tracking-wider">{k.label}</span>
                  <Icon className="size-3.5" />
                </div>
                <div className="text-2xl font-bold tabular-nums">{k.value.toLocaleString()}</div>
                <div className="text-[11px] text-muted-foreground">{k.hint}</div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {/* System health */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">System health</h2>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="default" className="gap-1">{configuredProviders} configured</Badge>
            {failedProviders > 0 && (
              <Badge variant="destructive" className="gap-1">{failedProviders} failed</Badge>
            )}
            <Badge variant="outline" className="gap-1">{providers.length} total</Badge>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((p) => (
            <Card key={p.id} className="py-4">
              <CardContent className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium leading-tight">{p.name}</div>
                  <ProviderStatusBadge status={p.status} />
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{p.detail}</p>
                <p className="text-[10px] text-muted-foreground tabular-nums">
                  Last checked: {new Date(p.lastChecked).toLocaleTimeString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Recent jobs */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ListChecks className="size-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Recent jobs</h2>
          </div>
          <Link
            href="/admin/jobs"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            View all <ArrowRight className="size-3" />
          </Link>
        </div>
        <Card className="py-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tool</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>User</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead className="text-right">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentJobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                    No jobs yet. Run a tool to see processing here.
                  </TableCell>
                </TableRow>
              ) : (
                recentJobs.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="font-medium">
                      <Link href={`/admin/jobs/${j.id}`} className="hover:underline">
                        {j.tool?.name ?? j.toolId}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={JOB_STATUS_BADGE[j.status] ?? "outline"}>{j.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {j.user?.email ?? "anonymous"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {formatDuration(durationMs(j.startedAt, j.completedAt))}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                      {new Date(j.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </section>

      {/* Link cards */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <LinkCard href="/admin/integrations" icon={Plug} title="Integrations" desc="Per-provider health and configuration." />
        <LinkCard href="/admin/workers" icon={Server} title="Workers" desc="Live worker heartbeats and queue status." />
        <LinkCard href="/admin/jobs" icon={ListChecks} title="Jobs" desc="Search and inspect every processing job." />
        <LinkCard href="/admin/analytics" icon={BarChart3} title="Analytics" desc="Usage trends and top tools." />
      </section>
    </div>
  );
}

function LinkCard({
  href,
  icon: Icon,
  title,
  desc,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <Link href={href} className="group">
      <Card className="py-4 h-full transition-shadow hover:shadow-md">
        <CardContent className="flex items-start gap-3">
          <div className="size-9 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0">
            <Icon className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-sm font-medium">
              {title}
              <ArrowRight className="size-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
