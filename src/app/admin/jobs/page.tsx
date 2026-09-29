import Link from "next/link";
import { db } from "@/lib/db";
import {
  Card,
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
import { Button } from "@/components/ui/button";
import { JobsFilters } from "./jobs-filters";
import { ChevronLeft, ChevronRight, ListChecks } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Jobs",
};

const PAGE_SIZE = 50;

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

const VALID_STATUSES = new Set([
  "created", "queued", "validating", "scanning", "processing",
  "validating_output", "completed", "failed", "cancelled", "expired",
]);

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-3)}` : id;
}

function formatDuration(startedAt: Date | null, completedAt: Date | null): string {
  if (!startedAt || !completedAt) return "—";
  const ms = completedAt.getTime() - startedAt.getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; queue?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const statusFilter = sp.status && VALID_STATUSES.has(sp.status) ? sp.status : undefined;
  const queueFilter = sp.queue;

  // Build where clause
  const where: Record<string, unknown> = {};
  if (statusFilter) where.status = statusFilter;
  if (queueFilter) where.tool = { category: { slug: queueFilter } };

  const [jobs, total] = await Promise.all([
    db.processingJob.findMany({
      where,
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      orderBy: { createdAt: "desc" },
      include: { tool: true, user: true },
    }),
    db.processingJob.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageHref(n: number): string {
    const p = new URLSearchParams();
    if (statusFilter) p.set("status", statusFilter);
    if (queueFilter) p.set("queue", queueFilter);
    p.set("page", String(n));
    return `/admin/jobs?${p.toString()}`;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Jobs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse and inspect every processing job. {total.toLocaleString()} total matching filters.
          </p>
        </div>
        <JobsFilters currentStatus={statusFilter} currentQueue={queueFilter} />
      </header>

      <Card className="py-0 overflow-hidden">
        <CardHeader className="border-b py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ListChecks className="size-4 text-muted-foreground" />
              Page {page} of {totalPages}
            </CardTitle>
            <CardDescription className="text-xs">
              Showing {jobs.length} of {total.toLocaleString()} jobs
            </CardDescription>
          </div>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job ID</TableHead>
              <TableHead>Tool</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Priority</TableHead>
              <TableHead className="text-right">Attempts</TableHead>
              <TableHead className="text-right">Duration</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">
                  No jobs match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell>
                    <Link
                      href={`/admin/jobs/${j.id}`}
                      className="font-mono text-xs hover:underline text-primary"
                      title={j.id}
                    >
                      {shortId(j.id)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{j.tool?.name ?? j.toolId}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {j.user?.email ?? "anonymous"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={JOB_STATUS_BADGE[j.status] ?? "outline"}>{j.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{j.priority}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {j.attempts}/{j.maxAttempts}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {formatDuration(j.startedAt, j.completedAt)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={j.errorCode ?? ""}>
                    {j.errorCode ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Page {page} / {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" disabled={page <= 1}>
            <Link href={pageHref(Math.max(1, page - 1))} aria-disabled={page <= 1}>
              <ChevronLeft className="size-4" /> Prev
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" disabled={page >= totalPages}>
            <Link href={pageHref(Math.min(totalPages, page + 1))}>
              Next <ChevronRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
