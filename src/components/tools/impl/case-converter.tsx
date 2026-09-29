'use client'

import { useMemo, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Copy, Check, Trash2, Type } from "lucide-react";
import { ClientToolShell } from "@/components/tools/client-tool-shell";

type CaseMode =
  | "upper" | "lower" | "title" | "sentence"
  | "camel" | "snake" | "kebab" | "constant";

const MODES: { id: CaseMode; label: string }[] = [
  { id: "upper", label: "UPPERCASE" },
  { id: "lower", label: "lowercase" },
  { id: "title", label: "Title Case" },
  { id: "sentence", label: "Sentence case" },
  { id: "camel", label: "camelCase" },
  { id: "snake", label: "snake_case" },
  { id: "kebab", label: "kebab-case" },
  { id: "constant", label: "CONSTANT_CASE" },
];

function wordsOf(text: string): string[] {
  // Split on non-alphanumeric runs but keep apostrophes inside words.
  return text
    .replace(/['’]/g, "'")
    .split(/[^A-Za-z0-9'_+-]+/)
    .map(w => w.replace(/^['']|['']$/g, ""))
    .filter(Boolean);
}

function toTitle(text: string): string {
  return text.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function toSentence(text: string): string {
  const lower = text.toLowerCase();
  // Capitalize the first letter overall, and after sentence-ending punctuation.
  return lower.replace(/(^\s*|[.!?]\s+)([a-z])/g, (_m, p1, p2) => p1 + p2.toUpperCase());
}

function toCamel(text: string): string {
  const words = wordsOf(text);
  return words
    .map((w, i) =>
      i === 0
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    )
    .join("");
}

function toSnake(text: string): string {
  return wordsOf(text).map(w => w.toLowerCase()).join("_");
}

function toKebab(text: string): string {
  return wordsOf(text).map(w => w.toLowerCase()).join("-");
}

function toConstant(text: string): string {
  return wordsOf(text).map(w => w.toUpperCase()).join("_");
}

function transform(text: string, mode: CaseMode): string {
  switch (mode) {
    case "upper": return text.toUpperCase();
    case "lower": return text.toLowerCase();
    case "title": return toTitle(text);
    case "sentence": return toSentence(text);
    case "camel": return toCamel(text);
    case "snake": return toSnake(text);
    case "kebab": return toKebab(text);
    case "constant": return toConstant(text);
  }
}

export default function CaseConverter() {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<CaseMode>("upper");
  const [copied, setCopied] = useState(false);

  const output = useMemo(() => transform(text, mode), [text, mode]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <ClientToolShell>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="cc-in">Input text</Label>
          <Textarea
            id="cc-in"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type or paste text…"
            className="min-h-[140px] text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label>Case mode</Label>
          <div className="flex flex-wrap gap-2">
            {MODES.map((m) => (
              <Button
                key={m.id}
                size="sm"
                variant={mode === m.id ? "default" : "outline"}
                onClick={() => setMode(m.id)}
                className="gap-1.5"
              >
                <Type className="h-3.5 w-3.5" />
                {m.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Output</Label>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={copy} disabled={!output} className="gap-1.5">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setText("")} disabled={!text} className="gap-1.5">
                <Trash2 className="h-4 w-4" /> Clear
              </Button>
            </div>
          </div>
          <pre className="min-h-[140px] overflow-auto rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap break-words">
            {output || <span className="text-muted-foreground">Output will appear here…</span>}
          </pre>
        </div>
      </div>
    </ClientToolShell>
  );
}
