'use client'

import { useMemo, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Trash2, Copy, Check } from "lucide-react";
import { ClientToolShell } from "@/components/tools/client-tool-shell";

const WPM = 200;

export default function WordCounter() {
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  const stats = useMemo(() => {
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
    const chars = text.length;
    const charsNoSpaces = text.replace(/\s/g, "").length;
    const sentences = trimmed ? (trimmed.match(/[^.!?]+[.!?]+(\s|$)/g)?.length ?? (trimmed ? 1 : 0)) : 0;
    const paragraphs = trimmed ? trimmed.split(/\n{2,}/).map(s => s.trim()).filter(Boolean).length : 0;
    const readingMinutes = words / WPM;
    const seconds = Math.round(readingMinutes * 60);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const readingTime = words === 0
      ? "0s"
      : mins > 0
        ? `${mins}m ${secs}s`
        : `${secs}s`;
    return { words, chars, charsNoSpaces, sentences, paragraphs, readingTime };
  }, [text]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  const statCards: { label: string; value: number | string; hint?: string }[] = [
    { label: "Words", value: stats.words },
    { label: "Characters", value: stats.chars },
    { label: "Characters (no spaces)", value: stats.charsNoSpaces },
    { label: "Sentences", value: stats.sentences },
    { label: "Paragraphs", value: stats.paragraphs },
    { label: "Reading time", value: stats.readingTime, hint: `@ ${WPM} wpm` },
  ];

  return (
    <ClientToolShell>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="wc-in">Your text</Label>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={copy} disabled={!text} className="gap-1.5">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setText("")} disabled={!text} className="gap-1.5">
                <Trash2 className="h-4 w-4" /> Clear
              </Button>
            </div>
          </div>
          <Textarea
            id="wc-in"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Start typing or paste your text here…"
            className="min-h-[220px] text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {statCards.map((s) => (
            <div key={s.label} className="rounded-lg border bg-card p-4">
              <div className="text-2xl font-semibold tabular-nums">{s.value}</div>
              <div className="mt-1 text-xs font-medium text-muted-foreground">
                {s.label}{s.hint ? <span className="ml-1 opacity-70">· {s.hint}</span> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </ClientToolShell>
  );
}
