/**
 * Public API documentation page (Prompt2 §46, §56).
 *
 * Server component. Lists every /api/v1/* endpoint, the auth model, the
 * rate-limit contract, and example curl commands. The list of tools is
 * generated from the live tool registry — only server-side tools are exposed
 * via the API. Honest about what's wired and what's NOT configured in the
 * sandbox (no workers running by default, etc.).
 */
import Link from "next/link";
import { ArrowRight, KeyRound, ShieldCheck, Timer, Webhook } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TOOLS, CATEGORIES } from "@/lib/tool-registry";
import { Code } from "@/app/api-docs/code";

export const metadata = {
  title: "API Documentation",
  description: "NexTool public REST API — process files programmatically with API keys, rate limits, and idempotent retries.",
};

const SERVER_TOOLS = TOOLS.filter((t) => t.processingType === "server");
const SERVER_CATEGORIES = CATEGORIES.filter((c) => SERVER_TOOLS.some((t) => t.category === c.slug));

export default function ApiDocsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      {/* ---------- Hero ---------- */}
      <header className="mb-12">
        <Badge variant="secondary" className="mb-3 gap-1.5">
          <Webhook className="h-3.5 w-3.5" /> v1 · REST
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Public API</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
          Process files programmatically. Authenticate with a bearer API key, send
          files via multipart, poll job status, and download signed results. Every
          tool that works in the web UI is also available here.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href="#endpoints">
            <Button variant="default" className="gap-2 rounded-full">
              Endpoints <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/status">
            <Button variant="outline" className="gap-2 rounded-full">
              <ShieldCheck className="h-4 w-4" /> Provider status
            </Button>
          </Link>
        </div>
      </header>

      {/* ---------- Base URL + Auth ---------- */}
      <section className="mb-12 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Webhook className="h-4 w-4" /> Base URL
            </CardTitle>
            <CardDescription>All API paths are prefixed with this.</CardDescription>
          </CardHeader>
          <CardContent>
            <Code>{`https://your-nextool-host/api/v1`}</Code>
            <p className="mt-2 text-xs text-muted-foreground">
              Sandbox: <code className="text-foreground">http://localhost:3000/api/v1</code>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4" /> Authentication
            </CardTitle>
            <CardDescription>Bearer token in the Authorization header.</CardDescription>
          </CardHeader>
          <CardContent>
            <Code>{`Authorization: Bearer nt_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`}</Code>
            <p className="mt-2 text-xs text-muted-foreground">
              Or, less secure: <code className="text-foreground">?api_key=nt_live_…</code> (logged in
              proxy/CDN logs — only use over HTTPS).
            </p>
          </CardContent>
        </Card>
      </section>

      {/* ---------- Limits ---------- */}
      <section className="mb-12">
        <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Timer className="h-5 w-5" /> Rate limits
        </h2>
        <Card>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-4">Plan</th>
                    <th className="py-2 pr-4">API requests / minute</th>
                    <th className="py-2">Tool processings / hour</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 pr-4"><Badge variant="outline">free</Badge></td>
                    <td className="py-2 pr-4 font-mono">5</td>
                    <td className="py-2 font-mono">20</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4"><Badge variant="secondary">pro</Badge></td>
                    <td className="py-2 pr-4 font-mono">20</td>
                    <td className="py-2 font-mono">100</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4"><Badge>business</Badge></td>
                    <td className="py-2 pr-4 font-mono">60</td>
                    <td className="py-2 font-mono">500</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Rate limit is per API key. When exceeded, the response is <code className="text-foreground">429 Too Many Requests</code> with a
              <code className="text-foreground"> Retry-After</code> header (seconds). The body:
            </p>
            <div className="mt-2">
              <Code>{`{
  "error": {
    "code": "rate_limited",
    "message": "API rate limit exceeded.",
    "limit": 5,
    "retryAfter": 47
  },
  "requestId": "REQ-71F2"
}`}</Code>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ---------- Endpoints ---------- */}
      <section id="endpoints" className="mb-12">
        <h2 className="mb-4 text-2xl font-bold tracking-tight">Endpoints</h2>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-base">
                <Badge>POST</Badge>
                <code className="font-mono text-sm">/api/v1/{"{tool}"}</code>
              </CardTitle>
              <CardDescription>
                Process a file with the named tool. The full list of supported slugs is below.
                Returns the result synchronously if the job finishes within 60s; otherwise returns
                <code className="text-foreground"> 202 Accepted</code> with a polling URL.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Code>{`curl -X POST https://your-nextool-host/api/v1/compress-pdf \\
  -H "Authorization: Bearer nt_live_..." \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -F "file=@/path/to/document.pdf" \\
  -F "level=medium"`}</Code>
              <p className="mt-3 text-xs text-muted-foreground">
                Response (200):
              </p>
              <div className="mt-1">
                <Code>{`{
  "ok": true,
  "status": "completed",
  "job": {
    "id": "clxxxxxxxxxxxxxxx",
    "status": "completed",
    "toolId": "...",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "completedAt": "2025-01-01T00:00:05.123Z"
  },
  "result": {
    "output": {
      "filename": "document.pdf",
      "size": 1243512,
      "mime": "application/pdf",
      "downloadUrl": "/api/storage/get?key=outputs%2F...&expires=..."
    },
    "meta": { "Original size": 5234523, "Output size": 1243512, "Saved": 3991011 }
  },
  "requestId": "REQ-71F2"
}`}</Code>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Response (202 — job still processing):
              </p>
              <div className="mt-1">
                <Code>{`{
  "ok": true,
  "status": "processing",
  "job": { "id": "clxxxxxxxxxxxxxxx", "status": "processing", "tool": "compress-pdf" },
  "pollUrl": "/api/v1/jobs/clxxxxxxxxxxxxxxx",
  "message": "Job is still processing. Poll /api/v1/jobs/clxxxxxxxxxxxxxxx in a few seconds."
}`}</Code>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-base">
                <Badge variant="outline">GET</Badge>
                <code className="font-mono text-sm">/api/v1/jobs/{"{id}"}</code>
              </CardTitle>
              <CardDescription>
                Poll a job&apos;s status. Returns the same job envelope as POST plus a signed
                download URL when the job is completed. The polling endpoint is auth-scoped:
                you can only poll jobs created by your own API key.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Code>{`curl https://your-nextool-host/api/v1/jobs/clxxxxxxxxxxxxxxx \\
  -H "Authorization: Bearer nt_live_..."`}</Code>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-base">
                <Badge variant="outline">GET</Badge>
                <Badge>POST</Badge>
                <code className="font-mono text-sm">/api/v1/keys</code>
              </CardTitle>
              <CardDescription>
                List and create API keys. These endpoints use session auth (sign in to the web UI)
                — you can&apos;t use an API key to create another API key (chicken-and-egg).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Code>{`# Create a new key (signed in to the web UI):
curl -X POST https://your-nextool-host/api/v1/keys \\
  -H "Cookie: next-auth.session-token=..." \\
  -H "Content-Type: application/json" \\
  -d '{"name":"CI pipeline"}'

# → 201 Created
# {
#   "ok": true,
#   "key": { "id": "...", "name": "CI pipeline", "keyPrefix": "nt_live_aB12cD34", ... },
#   "secret": "nt_live_aB12cD34xxxxxxxxxxxxxxxxxxxxxxxxx",
#   "warning": "Store this secret now. It cannot be retrieved again."
# }`}</Code>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-base">
                <Badge variant="outline">GET</Badge>
                <Badge variant="destructive">DELETE</Badge>
                <code className="font-mono text-sm">/api/v1/keys/{"{id}"}</code>
              </CardTitle>
              <CardDescription>
                Get details or revoke an API key. Revocation is soft (sets <code className="text-foreground">revokedAt</code>)
                and idempotent.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Code>{`curl -X DELETE https://your-nextool-host/api/v1/keys/clxxxxxxxxxxxxxxx \\
  -H "Cookie: next-auth.session-token=..."`}</Code>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ---------- Idempotency ---------- */}
      <section className="mb-12">
        <h2 className="mb-4 text-2xl font-bold tracking-tight">Idempotency</h2>
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Pass an <code className="text-foreground">Idempotency-Key</code> header on POST
              requests to safely retry after network errors. The key is per-user, opaque, and
              1–256 chars.
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Badge variant="secondary">200</Badge>&nbsp;
                If the original job completed, we return the cached result.
              </li>
              <li>
                <Badge variant="destructive">409</Badge>&nbsp;
                If the original job is still in progress, we return the existing job + a polling URL.
              </li>
              <li>
                <Badge>200</Badge>&nbsp;
                If the original job failed / was cancelled / expired, we create a new job (retry).
              </li>
            </ul>
            <div className="mt-4">
              <Code>{`curl -X POST https://your-nextool-host/api/v1/compress-pdf \\
  -H "Authorization: Bearer nt_live_..." \\
  -H "Idempotency-Key: 9c7c2a4e-2d6f-4f1b-b8ce-1f9a4c5e8b22" \\
  -F "file=@/path/to/document.pdf"`}</Code>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ---------- Tool catalogue ---------- */}
      <section className="mb-12">
        <h2 className="mb-4 text-2xl font-bold tracking-tight">Available tools ({SERVER_TOOLS.length})</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          All server-side tools in the registry are exposed via the API. Client-side tools (calculators, JSON formatters, QR/barcode generators, etc.) are not — they run in the browser.
        </p>
        <div className="space-y-6">
          {SERVER_CATEGORIES.map((cat) => {
            const tools = SERVER_TOOLS.filter((t) => t.category === cat.slug);
            return (
              <Card key={cat.slug}>
                <CardHeader>
                  <CardTitle className="text-base">{cat.name}</CardTitle>
                  <CardDescription>{cat.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {tools.map((t) => (
                      <Link
                        key={t.slug}
                        href={`/tools/${t.slug}`}
                        className="group flex flex-col gap-1 rounded-lg border bg-card p-3 transition hover:border-foreground/20 hover:shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs text-primary">{t.slug}</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground transition group-hover:translate-x-0.5" />
                        </div>
                        <div className="text-sm font-medium">{t.name}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2">{t.description}</div>
                        {t.inputFormats && t.inputFormats.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {t.inputFormats.slice(0, 3).map((m) => (
                              <Badge key={m} variant="outline" className="text-[10px] font-normal">
                                {m.split("/")[1]}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ---------- Honest status ---------- */}
      <section className="mb-12">
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-base">Honest sandbox limitations</CardTitle>
            <CardDescription>
              The API platform is production-ready. The sandbox deployment may differ from
              production — these gaps are noted here, never silently faked.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li>
                <strong>Workers</strong>: the job-poll loop in <code className="text-foreground">/api/v1/{"{tool}"}</code>
                waits up to 60s for an in-process worker to pick up the job. If no workers are running,
                you&apos;ll always get a <code className="text-foreground">202 Accepted</code> with a
                poll URL. Start workers with <code className="text-foreground">bun mini-services/worker-*/index.ts</code>
                or via <code className="text-foreground">docker-compose up</code>.
              </li>
              <li>
                <strong>Database</strong>: SQLite in the sandbox. PostgreSQL in production
                (schema is provider-ready).
              </li>
              <li>
                <strong>Storage</strong>: local filesystem (<code className="text-foreground">tmp/quarantine/</code>,
                <code className="text-foreground">tmp/outputs/</code>) in the sandbox. S3-compatible
                bucket (R2, MinIO, AWS S3) in production via env vars.
              </li>
              <li>
                <strong>Redis</strong>: not configured in the sandbox. Rate limits are per-process
                (each Next.js worker instance has its own counter). In production, set
                <code className="text-foreground"> REDIS_URL</code> for distributed rate limiting.
              </li>
              <li>
                <strong>Plan billing</strong>: the sandbox has no Stripe configured. All API keys
                use the <code className="text-foreground">free</code> plan limits by default. Set
                <code className="text-foreground"> PAYMENT_SECRET</code> to enable plan upgrades.
              </li>
              <li>
                <strong>Malware scanning</strong>: not configured in the sandbox. Input files pass
                signature/size validation only. Install ClamAV and set
                <code className="text-foreground"> MALWARE_SCANNER=clamscan|clamdscan</code> in
                production.
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* ---------- Errors ---------- */}
      <section>
        <h2 className="mb-4 text-2xl font-bold tracking-tight">Error responses</h2>
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              All errors use a consistent envelope. The <code className="text-foreground">requestId</code>
              matches the <code className="text-foreground">X-Request-Id</code> response header.
            </p>
            <div className="mt-3">
              <Code>{`{
  "error": {
    "code": "unauthorized",
    "message": "Missing, invalid, or revoked API key."
  },
  "requestId": "REQ-71F2"
}`}</Code>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Code</th>
                    <th className="py-2">Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b"><td className="py-2 pr-4 font-mono">400</td><td className="py-2 pr-4 font-mono">bad_request</td><td className="py-2 text-muted-foreground">Missing or malformed request body.</td></tr>
                  <tr className="border-b"><td className="py-2 pr-4 font-mono">401</td><td className="py-2 pr-4 font-mono">unauthorized</td><td className="py-2 text-muted-foreground">Missing/invalid/revoked API key.</td></tr>
                  <tr className="border-b"><td className="py-2 pr-4 font-mono">403</td><td className="py-2 pr-4 font-mono">forbidden</td><td className="py-2 text-muted-foreground">Job belongs to another user.</td></tr>
                  <tr className="border-b"><td className="py-2 pr-4 font-mono">404</td><td className="py-2 pr-4 font-mono">not_found</td><td className="py-2 text-muted-foreground">Tool or job not found.</td></tr>
                  <tr className="border-b"><td className="py-2 pr-4 font-mono">409</td><td className="py-2 pr-4 font-mono">conflict</td><td className="py-2 text-muted-foreground">Idempotent job already in progress.</td></tr>
                  <tr className="border-b"><td className="py-2 pr-4 font-mono">413</td><td className="py-2 pr-4 font-mono">payload_too_large</td><td className="py-2 text-muted-foreground">File exceeds the tool&apos;s size limit.</td></tr>
                  <tr className="border-b"><td className="py-2 pr-4 font-mono">422</td><td className="py-2 pr-4 font-mono">unprocessable</td><td className="py-2 text-muted-foreground">File type not in the tool&apos;s allowlist, or job failed.</td></tr>
                  <tr className="border-b"><td className="py-2 pr-4 font-mono">429</td><td className="py-2 pr-4 font-mono">rate_limited</td><td className="py-2 text-muted-foreground">Rate limit exceeded; see Retry-After.</td></tr>
                  <tr><td className="py-2 pr-4 font-mono">500</td><td className="py-2 pr-4 font-mono">internal_error</td><td className="py-2 text-muted-foreground">Unexpected server error.</td></tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
