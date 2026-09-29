'use client'

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, RefreshCw, Wand2 } from "lucide-react";
import { ClientToolShell } from "@/components/tools/client-tool-shell";

function clean(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim();
}

function generateSku(name: string, variant: string, category: string, salt: number): string {
  const namePart = clean(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.slice(0, 3).toUpperCase())
    .join("");
  const safeName = (namePart || "PRD").slice(0, 6).padEnd(3, "X");

  const variantPart = clean(variant)
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.slice(0, 2).toUpperCase())
    .join("")
    .slice(0, 4);

  const catPart = clean(category)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 1)
    .map((w) => w.slice(0, 2).toUpperCase())
    .join("");

  const rand = String(100 + Math.floor(salt * 899)).padStart(3, "0"); // deterministic per salt
  return [catPart, safeName, variantPart, rand].filter(Boolean).join("-");
}

export default function SkuGenerator() {
  const [name, setName] = useState<string>("Wireless Headphones");
  const [variant, setVariant] = useState<string>("Black Pro");
  const [category, setCategory] = useState<string>("Electronics");
  const [count, setCount] = useState<number>(5);
  const [skus, setSkus] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const handleGenerate = () => {
    const n = Math.max(1, Math.min(20, count));
    const baseName = name.trim();
    if (!baseName) {
      setSkus([]);
      return;
    }
    const result: string[] = [];
    const used = new Set<string>();
    for (let i = 0; i < n; i++) {
      // Deterministic per iteration, but vary by index for uniqueness
      let sku = generateSku(baseName, variant, category, (i + 1) / (n + 1));
      let counter = 1;
      while (used.has(sku)) {
        sku = generateSku(baseName, variant, category, (i + 1 + counter * 0.5) / (n + 1));
        counter++;
        if (counter > 100) break;
      }
      used.add(sku);
      result.push(sku);
    }
    setSkus(result);
    setCopied(false);
  };

  const copyAll = async () => {
    if (!skus.length) return;
    try {
      await navigator.clipboard.writeText(skus.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  const preview = useMemo(() => {
    const n = name.trim();
    if (!n) return null;
    return generateSku(n, variant, category, 0.5);
  }, [name, variant, category]);

  return (
    <ClientToolShell>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sku-name">Product name *</Label>
            <Input id="sku-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Wireless Headphones" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sku-variant">Variant</Label>
            <Input id="sku-variant" value={variant} onChange={(e) => setVariant(e.target.value)} placeholder="Black Pro" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sku-cat">Category (optional prefix)</Label>
            <Input id="sku-cat" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Electronics" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sku-count">Count (1–20)</Label>
            <Input
              id="sku-count"
              type="number"
              min={1}
              max={20}
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleGenerate} disabled={!name.trim()} className="gap-2">
            <Wand2 className="h-4 w-4" /> Generate SKUs
          </Button>
          <Button variant="ghost" onClick={() => { setName(""); setVariant(""); setCategory(""); setSkus([]); }} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Clear
          </Button>
        </div>

        {preview && !skus.length && (
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <span className="text-muted-foreground">Preview format: </span>
            <span className="font-mono">{preview}</span>
          </div>
        )}

        {skus.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {skus.length} SKU{skus.length === 1 ? "" : "s"} generated
              </p>
              <Button size="sm" variant="outline" onClick={copyAll} className="gap-1.5">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy all"}
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {skus.map((sku, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border bg-card p-2.5">
                  <Badge variant="secondary" className="font-mono">{i + 1}</Badge>
                  <code className="font-mono text-sm">{sku}</code>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Algorithm:</span> takes
          first 3 letters of product name + variant code + optional category
          prefix + 3-digit identifier. Diacritics stripped, output uppercased.
        </div>
      </div>
    </ClientToolShell>
  );
}
