'use client'

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, Palette, Trash2 } from "lucide-react";
import { ClientToolShell } from "@/components/tools/client-tool-shell";
import { ResultPanel, type RunState } from "@/components/tools/result-panel";

type RGB = { r: number; g: number; b: number };
type HSL = { h: number; s: number; l: number };

function clamp(v: number, min = 0, max = 255) {
  return Math.min(max, Math.max(min, v));
}

function clampHue(h: number) {
  const m = ((h % 360) + 360) % 360;
  return Math.round(m);
}

// HEX parsing: supports #rgb, #rrggbb, with or without #
function parseHex(hex: string): RGB | null {
  let h = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]+$/.test(h)) return null;
  if (h.length === 3) {
    h = h.split("").map((c) => c + c).join("");
  }
  if (h.length !== 6) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function toHex({ r, g, b }: RGB): string {
  const h = (n: number) => clamp(Math.round(n)).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function parseRgb(text: string): RGB | null {
  // Accept "r, g, b" or "rgb(r, g, b)"
  const m = text.trim().match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) {
    return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
  }
  const parts = text.split(",").map((s) => s.trim());
  if (parts.length === 3 && parts.every((p) => /^\d+$/.test(p))) {
    return { r: Number(parts[0]), g: Number(parts[1]), b: Number(parts[2]) };
  }
  return null;
}

function toRgbStr({ r, g, b }: RGB): string {
  return `${clamp(Math.round(r))}, ${clamp(Math.round(g))}, ${clamp(Math.round(b))}`;
}

function parseHsl(text: string): HSL | null {
  const m = text.trim().match(/^hsla?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%?\s*,\s*(\d+(?:\.\d+)?)%?/i);
  if (m) {
    return { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]) };
  }
  const parts = text.split(",").map((s) => s.trim().replace(/%$/, ""));
  if (parts.length === 3 && parts.every((p) => /^-?\d+(\.\d+)?$/.test(p))) {
    return { h: Number(parts[0]), s: Number(parts[1]), l: Number(parts[2]) };
  }
  return null;
}

// Standard RGB -> HSL conversion (https://en.wikipedia.org/wiki/HSL_and_HSV)
function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h: clampHue(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToRgb({ h, s, l }: HSL): RGB {
  const sn = s / 100, ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0, g1 = 0, b1 = 0;
  if (hp >= 0 && hp < 1) { r1 = c; g1 = x; }
  else if (hp < 2) { r1 = x; g1 = c; }
  else if (hp < 3) { g1 = c; b1 = x; }
  else if (hp < 4) { g1 = x; b1 = c; }
  else if (hp < 5) { r1 = x; b1 = c; }
  else { r1 = c; b1 = x; }
  const m = ln - c / 2;
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

export default function ColorConverter() {
  const [rgb, setRgb] = useState<RGB>({ r: 79, g: 70, b: 229 }); // indigo-600
  const [hexInput, setHexInput] = useState("#4f46e5");
  const [rgbInput, setRgbInput] = useState("79, 70, 229");
  const [hslInput, setHslInput] = useState("243, 75%, 59%");
  const [state, setState] = useState<RunState>("idle");
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState<string | null>(null);

  const hsl = useMemo(() => rgbToHsl(rgb), [rgb]);
  const swatch = useMemo(() => toHex(rgb), [rgb]);

  const applyRgb = (next: RGB) => {
    setRgb(next);
    setHexInput(toHex(next));
    setRgbInput(toRgbStr(next));
    const h = rgbToHsl(next);
    setHslInput(`${h.h}, ${h.s}%, ${h.l}%`);
  };

  const onHex = (v: string) => {
    setHexInput(v);
    const parsed = parseHex(v);
    if (parsed) {
      applyRgb(parsed);
      setState("idle");
      setError(undefined);
    } else {
      setState("error");
      setError("Invalid HEX: expected #rgb or #rrggbb");
    }
  };

  const onRgb = (v: string) => {
    setRgbInput(v);
    const parsed = parseRgb(v);
    if (parsed) {
      applyRgb(parsed);
      setState("idle");
      setError(undefined);
    } else {
      setState("error");
      setError("Invalid RGB: expected 'r, g, b' (0-255 each)");
    }
  };

  const onHsl = (v: string) => {
    setHslInput(v);
    const parsed = parseHsl(v);
    if (parsed) {
      const r = hslToRgb(parsed);
      applyRgb(r);
      setState("idle");
      setError(undefined);
    } else {
      setState("error");
      setError("Invalid HSL: expected 'h, s%, l%' format");
    }
  };

  const copyValue = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* ignore */ }
  };

  return (
    <ClientToolShell>
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-[160px_1fr] md:items-start">
          <div
            className="aspect-square w-full rounded-xl border shadow-inner"
            style={{ backgroundColor: swatch }}
            aria-label={`Color preview ${swatch}`}
          />
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>HEX</Label>
              <div className="flex gap-2">
                <Input
                  value={hexInput}
                  onChange={(e) => onHex(e.target.value)}
                  className="font-mono"
                  placeholder="#4f46e5"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyValue("hex", hexInput)}
                  aria-label="Copy HEX"
                >
                  {copied === "hex" ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>RGB</Label>
              <div className="flex gap-2">
                <Input
                  value={rgbInput}
                  onChange={(e) => onRgb(e.target.value)}
                  className="font-mono"
                  placeholder="79, 70, 229"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyValue("rgb", `rgb(${rgbInput})`)}
                  aria-label="Copy RGB"
                >
                  {copied === "rgb" ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>HSL</Label>
              <div className="flex gap-2">
                <Input
                  value={hslInput}
                  onChange={(e) => onHsl(e.target.value)}
                  className="font-mono"
                  placeholder="243, 75%, 59%"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyValue("hsl", `hsl(${hslInput})`)}
                  aria-label="Copy HSL"
                >
                  {copied === "hsl" ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1">
            <Palette className="h-3.5 w-3.5" />
            Live preview updates as you type valid values.
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              applyRgb({ r: 79, g: 70, b: 229 });
              setState("idle");
            }}
          >
            <Trash2 className="h-3.5 w-3.5" /> Reset
          </Button>
        </div>

        <ResultPanel state={state} error={error} onReset={() => setState("idle")} />
      </div>
    </ClientToolShell>
  );
}
