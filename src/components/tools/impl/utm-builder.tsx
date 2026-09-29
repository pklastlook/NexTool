'use client'

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Link2, AlertCircle } from "lucide-react";
import { ClientToolShell } from "@/components/tools/client-tool-shell";

export default function UtmBuilder() {
  const [baseUrl, setBaseUrl] = useState<string>("https://example.com/landing");
  const [source, setSource] = useState<string>("newsletter");
  const [medium, setMedium] = useState<string>("email");
  const [campaign, setCampaign] = useState<string>("spring_sale_2025");
  const [term, setTerm] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => {
    const trimmed = baseUrl.trim();
    if (!trimmed) return { error: "Base URL is required." };
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      return { error: "Base URL is invalid. Include the protocol, e.g. https://example.com" };
    }
    if (!/^https?:$/.test(url.protocol)) {
      return { error: "Base URL must use http or https protocol." };
    }
    if (!source.trim()) return { error: "utm_source is required." };
    if (!medium.trim()) return { error: "utm_medium is required." };
    if (!campaign.trim()) return { error: "utm_campaign is required." };

    const params = new URLSearchParams();
    params.set("utm_source", source.trim());
    params.set("utm_medium", medium.trim());
    params.set("utm_campaign", campaign.trim());
    if (term.trim()) params.set("utm_term", term.trim());
    if (content.trim()) params.set("utm_content", content.trim());

    // Preserve existing query params, append UTM after them
    const existing = url.searchParams;
    const finalUrl = new URL(url.origin + url.pathname + url.hash);
    for (const [k, v] of existing.entries()) finalUrl.searchParams.append(k, v);
    for (const [k, v] of params.entries()) finalUrl.searchParams.append(k, v);

    return { url: finalUrl.toString(), params: params.toString() };
  }, [baseUrl, source, medium, campaign, term, content]);

  const copy = async () => {
    if (!result.url) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <ClientToolShell>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="utm-base">Base URL *</Label>
          <Input
            id="utm-base"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://example.com/landing"
            className={result.error ? "border-red-500/60" : ""}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="utm-source">Campaign source * <Badge variant="secondary" className="ml-1 text-[10px]">utm_source</Badge></Label>
            <Input id="utm-source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="google, newsletter, facebook" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="utm-medium">Campaign medium * <Badge variant="secondary" className="ml-1 text-[10px]">utm_medium</Badge></Label>
            <Input id="utm-medium" value={medium} onChange={(e) => setMedium(e.target.value)} placeholder="cpc, email, social" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="utm-campaign">Campaign name * <Badge variant="secondary" className="ml-1 text-[10px]">utm_campaign</Badge></Label>
            <Input id="utm-campaign" value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="spring_sale_2025" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="utm-term">Campaign term <Badge variant="secondary" className="ml-1 text-[10px]">optional</Badge></Label>
            <Input id="utm-term" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="running+shoes" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="utm-content">Campaign content <Badge variant="secondary" className="ml-1 text-[10px]">optional</Badge></Label>
            <Input id="utm-content" value={content} onChange={(e) => setContent(e.target.value)} placeholder="header_cta, sidebar_link" />
          </div>
        </div>

        {result.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Invalid input</AlertTitle>
            <AlertDescription>{result.error}</AlertDescription>
          </Alert>
        )}

        {!result.error && result.url && (
          <>
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Link2 className="h-4 w-4" /> Final UTM URL
                </span>
                <Button size="sm" variant="outline" onClick={copy} className="gap-1.5">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <code className="block break-all font-mono text-xs leading-relaxed">{result.url}</code>
            </div>

            <div className="rounded-lg border p-3">
              <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Query string</div>
              <code className="block break-all font-mono text-xs">?{result.params}</code>
            </div>
          </>
        )}

        <p className="text-xs text-muted-foreground">
          Uses native <code>URL</code> + <code>URLSearchParams</code> for RFC-compliant
          percent-encoding. Existing query parameters on the base URL are preserved.
        </p>
      </div>
    </ClientToolShell>
  );
}
