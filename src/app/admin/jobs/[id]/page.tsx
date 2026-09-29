import Link from "next/link";
import { notFound } from "next/navigation";
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
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Download,
  FileText,
  FileOutput,
  AlertTriangle,
  Clock,
  ListTree,
  Hash,
  Layers,
} from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Job detail",
};

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

const EVENT_LEVEL_STYLE: Record<string, string> = {
  info: "border-l-blue-400 bg-blue-50/40 dark:bg-blue-950/20",
  warn: "border-l-amber-400 bg-amber-50/40 dark:bg-amber-950/20",
  error: "border-l-red-400 bg-red-50/40 dark:bg-red-950/20",
};

function formatDuration(startedAt: Date | null, completedAt: Date | null): string {
  if (!startedAt || !completedAt) return "—";
  const ms = completedAt.getTime() - startedAt.getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function safeParseJson(s: string | null): unknown {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return s; }
}

function prettyJson(v: unknown): string {
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const job = await db.processingJob.findUnique({
    where: { id },
    include: {
      tool: true,
      user: true,
      events: { orderBy: { createdAt: "asc" } },
      inputs: { orderBy: { createdAt: "asc" } },
      outputs: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!job) {
    notFound();
  }

  const optionsParsed = safeParseJson(job.options);
  const resultMetaParsed = safeParseJson(job.resultMeta);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
            <Link href="/admin/jobs">
              <ArrowLeft className="size-4" /> Back to jobs
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight font-mono">{job.id}</h1>
          <p className="text-sm text-muted-foreground">
            {job.tool?.name ?? job.toolId} · created {new Date(job.createdAt).toLocaleString()}
          </p>
        </div>
        <Badge variant={JOB_STATUS_BADGE[job.status] ?? "outline"} className="text-sm">
          {job.status}
        </Badge>
      </header>

      {/* Top grid: details + error */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 py-0">
          <CardHeader className="border-b py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="size-4 text-muted-foreground" /> Job details
            </CardTitle>
          </CardHeader>
          <CardContent className="py-4">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Field label="Tool">
                <Link href={`/tools/${job.tool?.slug ?? ""}`} className="text-primary hover:underline">
                  {job.tool?.name ?? job.toolId}
                </Link>
              </Field>
              <Field label="User">
                {job.user?.email ?? <span className="text-muted-foreground">anonymous</span>}
              </Field>
              <Field label="Status">
                <Badge variant={JOB_STATUS_BADGE[job.status] ?? "outline"}>{job.status}</Badge>
              </Field>
              <Field label="Priority">
                <span className="tabular-nums">{job.priority}</span>
              </Field>
              <Field label="Attempts">
                <span className="tabular-nums">{job.attempts} / {job.maxAttempts}</span>
              </Field>
              <Field label="Worker">
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{job.workerId ?? "—"}</code>
              </Field>
              <Field label="Started">
                <span className="tabular-nums">{job.startedAt ? new Date(job.startedAt).toLocaleString() : "—"}</span>
              </Field>
              <Field label="Completed">
                <span className="tabular-nums">{job.completedAt ? new Date(job.completedAt).toLocaleString() : "—"}</span>
              </Field>
              <Field label="Duration">
                <span className="tabular-nums inline-flex items-center gap-1">
                  <Clock className="size-3 text-muted-foreground" />
                  {formatDuration(job.startedAt, job.completedAt)}
                </span>
              </Field>
              <Field label="Idempotency key">
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{job.idempotencyKey ?? "—"}</code>
              </Field>
              <Field label="Created">
                <span className="tabular-nums">{new Date(job.createdAt).toLocaleString()}</span>
              </Field>
              <Field label="Updated">
                <span className="tabular-nums">{new Date(job.updatedAt).toLocaleString()}</span>
              </Field>
            </dl>
          </CardContent>
        </Card>

        {/* Error card */}
        <Card className="py-0">
          <CardHeader className="border-b py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="size-4 text-muted-foreground" /> Error
            </CardTitle>
          </CardHeader>
          <CardContent className="py-4">
            {job.errorCode ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="destructive" className="font-mono">{job.errorCode}</Badge>
                </div>
                <pre className="text-xs bg-destructive/5 dark:bg-destructive/10 border border-destructive/20 rounded p-2 whitespace-pre-wrap break-words font-mono">
{job.errorMessage ?? "(no message)"}
                </pre>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No error recorded — this job did not fail.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Options + Result metadata */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="py-0">
          <CardHeader className="border-b py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Hash className="size-4 text-muted-foreground" /> Options
            </CardTitle>
            <CardDescription className="text-xs">
              Input options supplied to the tool when the job was created.
            </CardDescription>
          </CardHeader>
          <CardContent className="py-4">
            {optionsParsed === null ? (
              <p className="text-sm text-muted-foreground">No options recorded.</p>
            ) : (
              <pre className="text-xs bg-muted rounded p-3 overflow-x-auto font-mono">
{prettyJson(optionsParsed)}
              </pre>
            )}
          </CardContent>
        </Card>

        <Card className="py-0">
          <CardHeader className="border-b py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileOutput className="size-4 text-muted-foreground" /> Result metadata
            </CardTitle>
            <CardDescription className="text-xs">
              Output sizes, counts, and other tool-reported metrics.
            </CardDescription>
          </CardHeader>
          <CardContent className="py-4">
            {resultMetaParsed === null ? (
              <p className="text-sm text-muted-foreground">No result metadata recorded.</p>
            ) : (
              <pre className="text-xs bg-muted rounded p-3 overflow-x-auto font-mono">
{prettyJson(resultMetaParsed)}
              </pre>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Inputs / outputs */}
      <section className="grid gap-4 lg:grid-cols-2">
        <FileAssetCard
          title="Input files"
          icon={FileText}
          files={job.inputs}
          dir="uploads"
        />
        <FileAssetCard
          title="Output files"
          icon={FileOutput}
          files={job.outputs}
          dir="outputs"
        />
      </section>

      {/* Event timeline */}
      <Card className="py-0">
        <CardHeader className="border-b py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ListTree className="size-4 text-muted-foreground" /> Event timeline
          </CardTitle>
          <CardDescription className="text-xs">
            Chronological log of every JobEvent recorded for this job.
          </CardDescription>
        </CardHeader>
        <CardContent className="py-4">
          {job.events.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No events recorded. Some jobs (especially in-process sandbox jobs) may not emit events.
            </p>
          ) : (
            <ol className="relative space-y-3 border-l ml-2">
              {job.events.map((ev) => {
                const cls = EVENT_LEVEL_STYLE[ev.level] ?? EVENT_LEVEL_STYLE.info;
                const meta = safeParseJson(ev.meta);
                return (
                  <li key={ev.id} className={`ml-3 rounded-md border-l-4 p-3 ${cls}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={ev.level === "error" ? "destructive" : ev.level === "warn" ? "outline" : "secondary"}
                        className="text-[10px] uppercase"
                      >
                        {ev.level}
                      </Badge>
                      <span className="text-sm font-medium">{ev.message}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                        {new Date(ev.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {meta !== null && (
                      <pre className="mt-2 text-[11px] bg-background/60 rounded p-2 overflow-x-auto font-mono">
{prettyJson(meta)}
                      </pre>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function FileAssetCard({
  title,
  icon: Icon,
  files,
  dir,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  files: Array<{
    id: string;
    originalName: string;
    safeName: string;
    size: number;
    mimeType: string;
    detectedMimeType: string | null;
    scanStatus: string;
    storageKey: string;
  }>;
  dir: "uploads" | "outputs";
}) {
  return (
    <Card className="py-0">
      <CardHeader className="border-b py-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" /> {title}
          <Badge variant="outline" className="ml-auto">{files.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="py-0">
        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No files.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead>MIME</TableHead>
                <TableHead>Scan</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="text-xs font-medium max-w-[200px] truncate" title={f.originalName}>
                    {f.originalName}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums">{formatBytes(f.size)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <span title={f.detectedMimeType ?? f.mimeType}>
                      {(f.detectedMimeType ?? f.mimeType).slice(0, 24)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={f.scanStatus === "clean" ? "default" : f.scanStatus === "infected" ? "destructive" : "outline"} className="text-[10px]">
                      {f.scanStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/api/download?key=${encodeURIComponent(f.storageKey)}&dir=${dir}&filename=${encodeURIComponent(f.originalName)}`}>
                        <Download className="size-3.5" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
