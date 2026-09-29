import { getProviderHealth, type ProviderHealth } from "@/lib/providers";
import { env } from "@/lib/env";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Database,
  HardDrive,
  Server,
  FileText,
  FileType2,
  Image as ImageIcon,
  Film,
  ScanText,
  PenTool,
  Mail,
  CreditCard,
  Sparkles,
  BarChart3,
  ShieldAlert,
  ShieldCheck,
  Cloud,
  Activity,
} from "lucide-react";
import { ProviderStatusBadge } from "@/components/admin/provider-status-badge";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Integration Center",
};

interface Section {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  providers: ProviderHealth[];
}

/**
 * Inline-augment the provider health list with security/edge providers that
 * aren't part of the core `getProviderHealth()` module. Each entry is an
 * HONEST env-presence check — never a fake "ok".
 */
function additionalProviders(): ProviderHealth[] {
  const now = new Date().toISOString();
  const list: ProviderHealth[] = [];

  // Cloudflare (WAF / cache in front of the app)
  const hasCf = !!(env as unknown as Record<string, string | undefined>).CF_API_TOKEN ||
                !!(env as unknown as Record<string, string | undefined>).CLOUDFLARE_API_TOKEN;
  list.push({
    id: "cloudflare",
    name: "Cloudflare (WAF & Cache)",
    category: "monitoring",
    status: hasCf ? "configured" : "not_configured",
    detail: hasCf
      ? "Cloudflare API token present."
      : "No CF_API_TOKEN set. Edge protection and CDN bypass the app in the sandbox.",
    lastChecked: now,
  });

  // Turnstile (bot protection on forms)
  const hasTurnstile = !!env.TURNSTILE_SITE_KEY && !!env.TURNSTILE_SECRET_KEY;
  list.push({
    id: "turnstile",
    name: "Cloudflare Turnstile",
    category: "malware", // re-uses the closest existing category for typing; UI groups by section, not by this
    status: hasTurnstile ? "configured" : "not_configured",
    detail: hasTurnstile
      ? "Site key + secret present. Forms include the Turnstile widget."
      : "No TURNSTILE_SITE_KEY/SECRET_KEY. Form submissions are not bot-protected.",
    lastChecked: now,
  });

  // Creative (AI image generation)
  const hasCreative = !!(env as unknown as Record<string, string | undefined>).CREATIVE_API_KEY ||
                      !!(env as unknown as Record<string, string | undefined>).ZAI_API_KEY;
  list.push({
    id: "creative",
    name: "Creative Engine (AI image generation)",
    category: "ai",
    status: hasCreative ? "configured" : "not_configured",
    detail: hasCreative
      ? "Creative key present."
      : "No CREATIVE_API_KEY set. AI image generation tools are disabled.",
    lastChecked: now,
  });

  return list;
}

export default async function IntegrationsPage() {
  const coreProviders = await getProviderHealth();
  const extra = additionalProviders();
  const all = [...coreProviders, ...extra];

  const byId = (id: string) => all.find((p) => p.id === id);

  const sections: Section[] = [
    {
      id: "infrastructure",
      title: "Infrastructure",
      description: "Core data plane dependencies.",
      icon: Database,
      providers: ["database", "queue", "storage"].map(byId).filter(Boolean) as ProviderHealth[],
    },
    {
      id: "processing",
      title: "Processing Engines",
      description: "Real binaries and libraries that perform file transformations.",
      icon: Server,
      providers: ["pdf", "office", "image", "media", "ocr", "creative"]
        .map(byId).filter(Boolean) as ProviderHealth[],
    },
    {
      id: "external",
      title: "External Services",
      description: "Third-party SaaS integrations.",
      icon: Cloud,
      providers: ["email", "payment", "ai", "analytics", "monitoring"]
        .map(byId).filter(Boolean) as ProviderHealth[],
    },
    {
      id: "security",
      title: "Security",
      description: "Bot protection, malware scanning and WAF.",
      icon: ShieldCheck,
      providers: ["turnstile", "malware", "cloudflare"]
        .map(byId).filter(Boolean) as ProviderHealth[],
    },
  ];

  const configuredCount = all.filter((p) => p.status === "configured").length;
  const failedCount = all.filter((p) => p.status === "failed").length;
  const notConfiguredCount = all.filter((p) => p.status === "not_configured").length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Integration Center</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Live status of every integration. Each row reflects a real check performed at render
          time — never a hardcoded &quot;ok&quot;.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="default" className="gap-1">
            <ShieldCheck className="size-3.5" /> {configuredCount} configured
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Activity className="size-3.5" /> {notConfiguredCount} not configured
          </Badge>
          {failedCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <ShieldAlert className="size-3.5" /> {failedCount} failed
            </Badge>
          )}
          <Badge variant="secondary" className="gap-1">
            Total: {all.length}
          </Badge>
        </div>
      </header>

      {sections.map((section) => {
        const SectionIcon = section.icon;
        return (
          <section key={section.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-md bg-muted text-muted-foreground grid place-items-center">
                <SectionIcon className="size-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold">{section.title}</h2>
                <p className="text-xs text-muted-foreground">{section.description}</p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {section.providers.map((p) => (
                <Card key={p.id} className="py-4">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-sm font-medium leading-tight">
                        {p.name}
                      </CardTitle>
                      <ProviderStatusBadge status={p.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-xs text-muted-foreground">{p.detail}</p>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="uppercase tracking-wider">ID</span>
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{p.id}</code>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="uppercase tracking-wider">Last checked</span>
                      <span className="tabular-nums">
                        {new Date(p.lastChecked).toLocaleString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        );
      })}

      <Card className="py-4 border-dashed bg-muted/30">
        <CardContent className="text-xs text-muted-foreground space-y-1">
          <div className="font-semibold text-foreground">Sandbox notes</div>
          <p>
            Each status is the result of a real check: Prisma <code>SELECT 1</code> for the
            database, env-presence for credentials, a <code>which</code> probe for ClamAV, and
            (where configured) live TCP/S3 probes via the health endpoints.
          </p>
          <p>
            Secrets are never exposed in this view — only presence and reachable-status are shown.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
