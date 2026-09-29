'use client'

import { useMemo, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Hash } from "lucide-react";
import { ClientToolShell } from "@/components/tools/client-tool-shell";

const DEFAULT_STOPWORDS = new Set<string>([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from",
  "has", "have", "he", "her", "his", "i", "in", "is", "it", "its",
  "of", "on", "or", "that", "the", "this", "to", "was", "were",
  "will", "with", "you", "your", "we", "they", "them", "our",
  "us", "my", "me", "him", "she", "so", "if", "than", "then",
  "can", "could", "should", "would", "do", "does", "did", "no", "not",
  "what", "which", "who", "whom", "when", "where", "why", "how",
  "all", "any", "both", "each", "few", "more", "most", "other",
  "some", "such", "only", "own", "same", "very", "just", "over",
  "into", "out", "up", "down", "off", "above", "below",
]);

interface WordStat { word: string; count: number; density: number; }

export default function KeywordDensity() {
  const [text, setText] = useState<string>("");
  const [minLength, setMinLength] = useState<number>(2);
  const [excludeStopwords, setExcludeStopwords] = useState<boolean>(true);

  const analysis = useMemo(() => {
    const cleaned = text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      // Keep word characters including apostrophes inside words
      .replace(/[^a-z0-9\s'-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) {
      return { totalWords: 0, uniqueWords: 0, totalChars: 0, top: [] as WordStat[] };
    }
    const tokens = cleaned.split(" ").filter(Boolean);
    const counts = new Map<string, number>();
    for (const t of tokens) {
      const w = t.replace(/^['-]+|['-]+$/g, "");
      if (!w) continue;
      if (w.length < minLength) continue;
      if (excludeStopwords && DEFAULT_STOPWORDS.has(w)) continue;
      counts.set(w, (counts.get(w) || 0) + 1);
    }
    const used = Array.from(counts.values()).reduce((a, b) => a + b, 0);
    const totalWords = tokens.length;
    const top = Array.from(counts.entries())
      .map(([word, count]) => ({ word, count, density: used > 0 ? (count / used) * 100 : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 25);
    return {
      totalWords,
      uniqueWords: counts.size,
      totalChars: text.length,
      top,
    };
  }, [text, minLength, excludeStopwords]);

  return (
    <ClientToolShell>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="kd-text">Paste your content</Label>
          <Textarea
            id="kd-text"
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste an article, blog post, or any text you want to analyse…"
            className="font-mono text-sm"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="kd-min">Min word length</Label>
            <Input
              id="kd-min"
              type="number"
              min={1}
              max={10}
              value={minLength}
              onChange={(e) => setMinLength(parseInt(e.target.value, 10) || 1)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Stop words</Label>
            <div className="flex h-9 items-center gap-2 rounded-md border px-3">
              <button
                type="button"
                onClick={() => setExcludeStopwords(true)}
                className={`rounded-md px-2 py-0.5 text-xs ${excludeStopwords ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                Exclude
              </button>
              <button
                type="button"
                onClick={() => setExcludeStopwords(false)}
                className={`rounded-md px-2 py-0.5 text-xs ${!excludeStopwords ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                Include
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Quick stats</Label>
            <div className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
              <Badge variant="secondary">{analysis.totalWords} words</Badge>
              <Badge variant="secondary">{analysis.uniqueWords} unique</Badge>
            </div>
          </div>
        </div>

        {analysis.top.length > 0 && (
          <div className="rounded-lg border">
            <div className="flex items-center gap-1.5 border-b px-4 py-2 text-sm font-medium">
              <Hash className="h-4 w-4" /> Top {analysis.top.length} keywords
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Keyword</TableHead>
                  <TableHead className="w-20 text-right">Count</TableHead>
                  <TableHead className="w-32 text-right">Density</TableHead>
                  <TableHead className="w-1/3">Bar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analysis.top.map((row, i) => (
                  <TableRow key={row.word}>
                    <TableCell className="font-mono text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{row.word}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.density.toFixed(2)}%</TableCell>
                    <TableCell>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.min(100, (row.count / analysis.top[0].count) * 100)}%` }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {analysis.totalWords === 0 && (
          <p className="text-sm text-muted-foreground">
            Paste some text above to see keyword frequency and density analysis.
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Density = (keyword occurrences ÷ total non-stopword tokens) × 100.
          Common English stop words are filtered by default for a cleaner SEO view.
        </p>
      </div>
    </ClientToolShell>
  );
}
