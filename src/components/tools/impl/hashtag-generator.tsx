'use client';

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Hash, Wand2, Copy, Check, Trash2, Download } from "lucide-react";
import { ClientToolShell } from "@/components/tools/client-tool-shell";
import { ResultPanel, type RunState } from "@/components/tools/result-panel";

type Options = {
  pluralize: boolean;
  includeInsta: boolean;
  includeLife: boolean;
  includeLover: boolean;
  includeDaily: boolean;
  includeOfTheDay: boolean;
  includeGram: boolean;
  includeLoveYour: boolean;
};

const DEFAULT_OPTS: Options = {
  pluralize: true,
  includeInsta: true,
  includeLife: true,
  includeLover: true,
  includeDaily: true,
  includeOfTheDay: true,
  includeGram: true,
  includeLoveYour: true,
};

const STOPWORDS = new Set([
  "the", "a", "an", "of", "and", "or", "but", "for", "to", "in", "on", "at", "by",
]);

function normalizeKeyword(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pluralize(word: string): string {
  if (!word) return word;
  if (/(s|x|z|ch|sh)$/.test(word)) return word + "es";
  if (/[^aeiou]y$/.test(word)) return word.slice(0, -1) + "ies";
  return word + "s";
}

function camelCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function generateHashtags(raw: string, opts: Options): string[] {
  const norm = normalizeKeyword(raw);
  if (!norm) return [];
  // Strip stopwords from multi-word input but keep the phrase
  const phrase = norm.replace(/\s+/g, "");
  const words = norm.split(" ").filter((w) => w && !STOPWORDS.has(w));
  const stem = words.length > 0 ? words.join("") : phrase;
  const stemCamel = words.length > 0 ? words.map(camelCase).join("") : camelCase(phrase);
  const plural = pluralize(stem);

  const set = new Set<string>();
  const add = (s: string) => {
    const v = s.replace(/[^a-z0-9]/gi, "");
    if (v) set.add("#" + v);
  };

  // base
  add(stem);
  if (opts.pluralize) add(plural);

  // compound suffixes
  if (opts.includeLover) { add(`${stem}lover`); add(`${stem}lovers`); }
  if (opts.includeLife) add(`${stem}life`);
  if (opts.includeGram) add(`${stem}gram`);
  if (opts.includeDaily) add(`${stem}daily`);
  if (opts.includeOfTheDay) add(`${stem}oftheday`);
  if (opts.includeLoveYour) add(`loveyour${stem}`);

  // insta prefix variations
  if (opts.includeInsta) {
    add(`insta${stem}`);
    add(`insta${stemCamel}`);
    add(`${stem}insta`);
  }

  // category-flavored extras (purely deterministic transforms)
  add(`${stem}community`);
  add(`${stem}love`);
  add(`${stem}fan`);
  add(`${stem}fans`);
  add(`top${stemCamel}`);
  add(`best${stemCamel}`);
  add(`${stem}world`);
  add(`${stem}vibes`);
  add(`${stem}addict`);
  add(`${stem}photography`);
  add(`${stem}art`);
  add(`${stem}tips`);

  return Array.from(set);
}

export default function HashtagGenerator() {
  const [input, setInput] = useState("");
  const [opts, setOpts] = useState<Options>(DEFAULT_OPTS);
  const [state, setState] = useState<RunState>("idle");
  const [error, setError] = useState<string>();
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const preview = useMemo(() => generateHashtags(input, opts), [input, opts]);

  const run = () => {
    setState("running");
    setError(undefined);
    setHashtags([]);
    try {
      const trimmed = input.trim();
      if (!trimmed) throw new Error("Enter a keyword or topic.");
      const list = generateHashtags(trimmed, opts);
      if (list.length === 0) throw new Error("Could not generate hashtags from that input.");
      setHashtags(list);
      setState("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  };

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(hashtags.join(" "));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  const downloadTxt = () => {
    const blob = new Blob([hashtags.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hashtags-${normalizeKeyword(input) || "topic"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggle = (key: keyof Options) => (v: boolean) => setOpts((o) => ({ ...o, [key]: v }));

  const switches: { key: keyof Options; label: string }[] = [
    { key: "pluralize", label: "Plural (e.g. #cats)" },
    { key: "includeLover", label: "Lover / Lovers" },
    { key: "includeLife", label: "Life" },
    { key: "includeGram", label: "Gram" },
    { key: "includeDaily", label: "Daily" },
    { key: "includeOfTheDay", label: "Of the day" },
    { key: "includeLoveYour", label: "Love your…" },
    { key: "includeInsta", label: "Insta- prefix" },
  ];

  return (
    <ClientToolShell>
      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="hashtag-input">Keyword or topic</Label>
          <Input
            id="hashtag-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") run(); }}
            placeholder="e.g. coffee, travel, fitness"
          />
          <p className="text-xs text-muted-foreground">
            Pure client-side generation — no external APIs.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {switches.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <Label htmlFor={`opt-${s.key}`} className="cursor-pointer text-sm">{s.label}</Label>
              <Switch id={`opt-${s.key}`} checked={opts[s.key]} onCheckedChange={toggle(s.key)} />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={run} disabled={!input.trim() || state === "running"} className="gap-2">
            <Wand2 className="h-4 w-4" /> Generate hashtags
          </Button>
          <Button
            variant="ghost"
            onClick={() => { setInput(""); setHashtags([]); setState("idle"); setError(undefined); }}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" /> Clear
          </Button>
          {input.trim() && (
            <Badge variant="outline" className="gap-1.5">
              <Hash className="h-3 w-3" /> Live preview: {preview.length}
            </Badge>
          )}
        </div>

        {state === "success" && hashtags.length > 0 && (
          <div className="space-y-3 rounded-lg border bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{hashtags.length}</span> hashtags generated
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={copyAll} className="gap-1.5">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy all"}
                </Button>
                <Button size="sm" onClick={downloadTxt} className="gap-1.5">
                  <Download className="h-4 w-4" /> Download .txt
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {hashtags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
            </div>
            <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs">{hashtags.join(" ")}</pre>
          </div>
        )}

        <ResultPanel state={state} error={error} onReset={() => setState("idle")} />
      </div>
    </ClientToolShell>
  );
}
