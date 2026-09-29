'use client'

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Check } from "lucide-react";
import { ClientToolShell } from "@/components/tools/client-tool-shell";

function escapeAttr(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escapeText(s: string): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default function MetaTagGenerator() {
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [url, setUrl] = useState<string>("");
  const [image, setImage] = useState<string>("");
  const [author, setAuthor] = useState<string>("");
  const [siteName, setSiteName] = useState<string>("");
  const [twitterHandle, setTwitterHandle] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const html = useMemo(() => {
    const lines: string[] = [];
    const t = title.trim();
    const d = description.trim();
    const u = url.trim();
    const img = image.trim();
    const a = author.trim();
    const sn = siteName.trim();
    const tw = twitterHandle.trim().replace(/^@/, "");

    if (t) lines.push(`<title>${escapeText(t)}</title>`);
    if (d) lines.push(`<meta name="description" content="${escapeAttr(d)}" />`);
    if (a) lines.push(`<meta name="author" content="${escapeAttr(a)}" />`);
    lines.push('<meta name="robots" content="index, follow" />');
    lines.push(`<meta name="generator" content="NexTool Meta Tag Generator" />`);

    if (u) {
      lines.push('<link rel="canonical" href="' + escapeAttr(u) + '" />');
    }

    // Open Graph
    if (t || d || u || img || sn) {
      lines.push("");
      lines.push("<!-- Open Graph -->");
      if (t) lines.push(`<meta property="og:title" content="${escapeAttr(t)}" />`);
      if (d) lines.push(`<meta property="og:description" content="${escapeAttr(d)}" />`);
      if (u) lines.push(`<meta property="og:url" content="${escapeAttr(u)}" />`);
      if (img) lines.push(`<meta property="og:image" content="${escapeAttr(img)}" />`);
      lines.push('<meta property="og:type" content="website" />');
      if (sn) lines.push(`<meta property="og:site_name" content="${escapeAttr(sn)}" />`);
    }

    // Twitter
    if (t || d || img) {
      lines.push("");
      lines.push("<!-- Twitter Card -->");
      lines.push('<meta name="twitter:card" content="' + (img ? "summary_large_image" : "summary") + '" />');
      if (t) lines.push(`<meta name="twitter:title" content="${escapeAttr(t)}" />`);
      if (d) lines.push(`<meta name="twitter:description" content="${escapeAttr(d)}" />`);
      if (img) lines.push(`<meta name="twitter:image" content="${escapeAttr(img)}" />`);
      if (tw) lines.push(`<meta name="twitter:site" content="@${escapeAttr(tw)}" />`);
    }

    return lines.join("\n");
  }, [title, description, url, image, author, siteName, twitterHandle]);

  const copy = async () => {
    if (!html) return;
    try {
      await navigator.clipboard.writeText(html);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  const charCount = title.length;
  const descCount = description.length;

  return (
    <ClientToolShell>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="mt-title">Title</Label>
              <span className={`text-xs ${charCount > 60 ? "text-amber-500" : "text-muted-foreground"}`}>
                {charCount}/60
              </span>
            </div>
            <Input id="mt-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My Awesome Page" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="mt-desc">Description</Label>
              <span className={`text-xs ${descCount > 160 ? "text-amber-500" : "text-muted-foreground"}`}>
                {descCount}/160
              </span>
            </div>
            <Textarea
              id="mt-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short, compelling summary of this page (150–160 characters is ideal)."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mt-url">Site / page URL</Label>
            <Input id="mt-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/page" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mt-image">Image URL</Label>
            <Input id="mt-image" value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://example.com/og.png" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mt-author">Author</Label>
            <Input id="mt-author" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mt-sitename">Site name</Label>
            <Input id="mt-sitename" value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="My Brand" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mt-tw">Twitter handle</Label>
            <Input id="mt-tw" value={twitterHandle} onChange={(e) => setTwitterHandle(e.target.value)} placeholder="@yourhandle" />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Generated HTML</p>
            <Button size="sm" variant="outline" onClick={copy} disabled={!html} className="gap-1.5">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-3 text-xs font-mono leading-relaxed">
{html || "// fill in the fields above to generate meta tags"}
          </pre>
        </div>

        <p className="text-xs text-muted-foreground">
          Output includes standard &lt;title&gt;, meta description, canonical link,
          Open Graph (Facebook / LinkedIn) and Twitter Card tags. Paste into the
          &lt;head&gt; of your HTML.
        </p>
      </div>
    </ClientToolShell>
  );
}
