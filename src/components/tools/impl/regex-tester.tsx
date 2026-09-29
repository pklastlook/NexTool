'use client'

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Regex, Trash2, Copy, Check } from "lucide-react";
import { ClientToolShell } from "@/components/tools/client-tool-shell";
import { ResultPanel, type RunState } from "@/components/tools/result-panel";

interface MatchInfo {
  match: string;
  index: number;
  groups: (string | undefined)[];
}

function runRegex(pattern: string, flags: string, text: string): { matches: MatchInfo[]; globalFlag: boolean } {
  if (!pattern) return { matches: [], globalFlag: flags.includes("g") };
  const re = new RegExp(pattern, flags);
  const globalFlag = flags.includes("g");
  const matches: MatchInfo[] = [];
  if (globalFlag) {
    let m: RegExpExecArray | null;
    // Use a fresh regex to avoid lastIndex pitfalls
    const g = new RegExp(pattern, flags);
    while ((m = g.exec(text)) !== null) {
      matches.push({ match: m[0], index: m.index, groups: m.slice(1) });
      if (m.index === g.lastIndex) g.lastIndex++; // avoid infinite loop on zero-width matches
      if (matches.length > 10000) break;
    }
  } else {
    const m = re.exec(text);
    if (m) matches.push({ match: m[0], index: m.index, groups: m.slice(1) });
  }
  return { matches, globalFlag };
}

// Build highlighted HTML by wrapping matches in <mark>
function highlight(text: string, matches: MatchInfo[]): string {
  if (matches.length === 0) return escapeHtml(text);
  const parts: string[] = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.index < cursor) continue; // overlap guard
    parts.push(escapeHtml(text.slice(cursor, m.index)));
    parts.push(`<mark class="rounded bg-amber-300/60 px-0.5 dark:bg-amber-500/40">${escapeHtml(m.match)}</mark>`);
    cursor = m.index + m.match.length;
    if (cursor > text.length) break;
  }
  parts.push(escapeHtml(text.slice(cursor)));
  return parts.join("");
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&#39;";
    }
  });
}

export default function RegexTester() {
  const [pattern, setPattern] = useState("");
  const [flags, setFlags] = useState<string>("g");
  const [text, setText] = useState("");
  const [state, setState] = useState<RunState>("idle");
  const [error, setError] = useState<string>();
  const [matches, setMatches] = useState<MatchInfo[]>([]);
  const [copied, setCopied] = useState(false);

  // Live-evaluate whenever pattern/flags/text change (debounced naturally by React)
  const result = useMemo(() => {
    if (!pattern) return null;
    try {
      const r = runRegex(pattern, flags || "", text);
      return r;
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e), matches: [] as MatchInfo[], globalFlag: false };
    }
  }, [pattern, flags, text]);

  const run = () => {
    setState("running");
    setError(undefined);
    setMatches([]);
    try {
      if (!pattern.trim()) throw new Error("Pattern is empty.");
      const r = runRegex(pattern, flags, text);
      setMatches(r.matches);
      setState("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  };

  const toggleFlag = (f: string) => {
    setFlags((cur) => (cur.includes(f) ? cur.replace(f, "") : cur + f));
  };

  const copyMatches = async () => {
    try {
      await navigator.clipboard.writeText(matches.map((m) => m.match).join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  const liveError = result && "error" in result ? result.error : null;
  const liveMatches = result && !("error" in result) ? result.matches : [];
  const highlighted = highlight(text, liveMatches);

  return (
    <ClientToolShell>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="rx-pattern">Pattern</Label>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">/</span>
            <Input
              id="rx-pattern"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="\\b\\w+@\\w+\\.\\w+\\b"
              className="flex-1 font-mono"
            />
            <span className="text-muted-foreground">/</span>
            <Input
              value={flags}
              onChange={(e) => setFlags(e.target.value.replace(/[^gimsuy]/g, ""))}
              className="w-20 font-mono text-center"
              maxLength={6}
              aria-label="flags"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {(["g", "i", "m", "s", "u", "y"] as const).map((f) => (
            <label key={f} className="flex items-center gap-2 text-sm">
              <Checkbox checked={flags.includes(f)} onCheckedChange={() => toggleFlag(f)} />
              <code className="font-mono">{f}</code>
            </label>
          ))}
          <p className="text-xs text-muted-foreground">g=global · i=case-insensitive · m=multiline · s=dotall · u=unicode · y=sticky</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rx-text">Test string</Label>
          <Textarea
            id="rx-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the text to search…"
            className="min-h-[140px] font-mono text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={run} disabled={!pattern.trim() || state === "running"} className="gap-2">
            <Regex className="h-4 w-4" /> Run match
          </Button>
          <Button variant="ghost" onClick={() => { setPattern(""); setFlags("g"); setText(""); setMatches([]); setState("idle"); }} className="gap-2">
            <Trash2 className="h-4 w-4" /> Clear
          </Button>
        </div>

        {/* Live highlight preview */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Live match highlight</Label>
            {liveError ? (
              <span className="text-xs text-destructive">Pattern error: {liveError}</span>
            ) : liveMatches.length > 0 ? (
              <span className="text-xs text-emerald-600 dark:text-emerald-400">{liveMatches.length} match{liveMatches.length !== 1 ? "es" : ""}</span>
            ) : pattern ? (
              <span className="text-xs text-muted-foreground">No matches</span>
            ) : null}
          </div>
          <pre
            className="max-h-48 overflow-auto rounded-lg bg-muted p-3 font-mono text-sm whitespace-pre-wrap break-all"
            dangerouslySetInnerHTML={{ __html: highlighted || "<span class=\"text-muted-foreground\">Type text above to see matches highlighted…</span>" }}
          />
        </div>

        {state === "success" && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {matches.length} match{matches.length !== 1 ? "es" : ""} found
              </p>
              <Button size="sm" variant="outline" onClick={copyMatches} className="gap-1.5" disabled={matches.length === 0}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy matches"}
              </Button>
            </div>
            {matches.length > 0 && (
              <div className="max-h-80 overflow-auto rounded-lg bg-muted p-3">
                <table className="w-full text-left text-xs">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="pr-3 pb-2">#</th>
                      <th className="pr-3 pb-2">Index</th>
                      <th className="pr-3 pb-2">Match</th>
                      <th className="pb-2">Groups</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {matches.map((m, i) => (
                      <tr key={i} className="border-t">
                        <td className="pr-3 py-1.5 text-muted-foreground">{i + 1}</td>
                        <td className="pr-3 py-1.5">{m.index}</td>
                        <td className="pr-3 py-1.5 break-all">{m.match || "(empty)"}</td>
                        <td className="py-1.5 break-all text-muted-foreground">
                          {m.groups.length === 0 ? "—" : m.groups.map((g) => g ?? "(undefined)").join(" | ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <ResultPanel state={state} error={error || liveError || undefined} onReset={() => setState("idle")} />
      </div>
    </ClientToolShell>
  );
}
