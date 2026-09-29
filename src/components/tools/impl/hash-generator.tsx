'use client'

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Hash, Trash2, Copy, Check } from "lucide-react";
import { ClientToolShell } from "@/components/tools/client-tool-shell";
import { ResultPanel, type RunState } from "@/components/tools/result-panel";

type Algo = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";

const ALGOS: Algo[] = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];

async function digest(algo: Algo, text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest(algo, data);
  const bytes = new Uint8Array(buf);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function HashGenerator() {
  const [input, setInput] = useState("");
  const [algo, setAlgo] = useState<Algo>("SHA-256");
  const [state, setState] = useState<RunState>("idle");
  const [error, setError] = useState<string>();
  const [hashes, setHashes] = useState<Partial<Record<Algo, string>>>({});
  const [copiedAlgo, setCopiedAlgo] = useState<Algo | null>(null);

  const run = async () => {
    setState("running");
    setError(undefined);
    setHashes({});
    try {
      if (!input) throw new Error("Input is empty.");
      // Compute the selected algorithm; also compute all four for convenience.
      const results: Partial<Record<Algo, string>> = {};
      for (const a of ALGOS) {
        results[a] = await digest(a, input);
      }
      setHashes(results);
      setState("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  };

  const copy = async (a: Algo, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedAlgo(a);
      setTimeout(() => setCopiedAlgo(null), 1500);
    } catch { /* ignore */ }
  };

  return (
    <ClientToolShell>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="hash-in">Input text</Label>
          <Textarea
            id="hash-in"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type any text to hash…"
            className="min-h-[150px] font-mono text-sm"
          />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>Algorithm</Label>
            <Select value={algo} onValueChange={(v) => setAlgo(v as Algo)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ALGOS.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={run} disabled={!input || state === "running"} className="gap-2">
            <Hash className="h-4 w-4" /> Generate hash
          </Button>
          <Button variant="ghost" onClick={() => { setInput(""); setHashes({}); setState("idle"); }} className="gap-2">
            <Trash2 className="h-4 w-4" /> Clear
          </Button>
        </div>

        {state === "success" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Computed all four algorithms via Web Crypto (<code>crypto.subtle.digest</code>). The selected algorithm is highlighted.
            </p>
            <div className="space-y-2">
              {ALGOS.map((a) => {
                const value = hashes[a] ?? "";
                const isPrimary = a === algo;
                return (
                  <div
                    key={a}
                    className={`rounded-lg border p-3 ${isPrimary ? "border-primary/60 bg-primary/5" : "bg-muted/40"}`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{a}</span>
                        {isPrimary && <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">selected</span>}
                        <span className="text-xs text-muted-foreground">{value.length * 4} bits</span>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => copy(a, value)} className="h-7 gap-1.5 px-2">
                        {copiedAlgo === a ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <code className="block font-mono text-xs break-all">{value}</code>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <ResultPanel state={state} error={error} onReset={() => setState("idle")} />
      </div>
    </ClientToolShell>
  );
}
