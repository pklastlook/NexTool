'use client'

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Wand2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ClientToolShell } from "@/components/tools/client-tool-shell";

function slugify(text: string, separator: string, lowercase: boolean): string {
  let s = (text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^A-Za-z0-9\s_-]+/g, "") // strip punctuation (keep alnum, space, _, -)
    .trim();
  if (lowercase) s = s.toLowerCase();
  // Replace whitespace + underscores with separator
  s = s.replace(/[\s_]+/g, separator);
  // Collapse multiple separators
  const re = new RegExp(`\\${separator}{2,}`, "g");
  s = s.replace(re, separator);
  // Trim leading/trailing separators
  const reTrim = new RegExp(`^\\${separator}+|\\${separator}+$`, "g");
  s = s.replace(reTrim, "");
  return s;
}

export default function SlugGenerator() {
  const [text, setText] = useState<string>("Hello World! This is a Test Title — 2025");
  const [separator, setSeparator] = useState<string>("-");
  const [lowercase, setLowercase] = useState<boolean>(true);
  const [copied, setCopied] = useState(false);

  const slug = useMemo(() => slugify(text, separator, lowercase), [text, separator, lowercase]);

  const copy = async () => {
    if (!slug) return;
    try {
      await navigator.clipboard.writeText(slug);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  const sampleInputs = [
    "How to Bake Sourdough Bread (Step-by-Step!)",
    "Café résumé — Été 2025",
    "Top 10 JavaScript  Tricks & Tips",
    "Crème brûlée vs. flan",
  ];

  return (
    <ClientToolShell>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="slug-text">Title / text</Label>
          <Textarea
            id="slug-text"
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste any title or string…"
          />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>Separator</Label>
            <Select value={separator} onValueChange={setSeparator}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="-">Hyphen (-)</SelectItem>
                <SelectItem value="_">Underscore (_)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={lowercase ? "default" : "outline"}
              size="sm"
              onClick={() => setLowercase((v) => !v)}
              className="gap-1.5"
            >
              {lowercase ? "ON" : "OFF"} lowercase
            </Button>
          </div>
          <Button onClick={copy} disabled={!slug} variant="outline" className="gap-1.5 ml-auto">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy slug"}
          </Button>
        </div>

        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
            <Wand2 className="h-3.5 w-3.5" /> Slug
          </div>
          <code className="block break-all font-mono text-base font-semibold">{slug || "—"}</code>
          <div className="mt-2 flex gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{slug.length} chars</Badge>
            <Badge variant="secondary">{slug.split(separator).filter(Boolean).length} words</Badge>
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Try a sample</div>
          <div className="flex flex-wrap gap-2">
            {sampleInputs.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setText(s)}
                className="rounded-full border bg-card px-3 py-1 text-xs hover:bg-muted transition"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Real slugify pipeline: NFD-normalize → strip diacritics → remove
          punctuation → collapse whitespace to separator → dedupe separators →
          trim. URL-safe and SEO-friendly.
        </p>
      </div>
    </ClientToolShell>
  );
}
