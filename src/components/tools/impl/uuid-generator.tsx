'use client'

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Fingerprint, Trash2, Copy, Check, RefreshCw } from "lucide-react";
import { ClientToolShell } from "@/components/tools/client-tool-shell";
import { ResultPanel, type RunState } from "@/components/tools/result-panel";

type Version = "v4" | "v7";

// Generate a UUIDv7 (RFC 9562)
// Layout: 8 hex (top 32 bits of unix ms ts) - 4 hex (bottom 16 bits of ts) - 4 hex (v7 + 12 bits randA) - 4 hex (variant + 14 bits randB) - 12 hex (48 bits randB tail)
function uuidv7(): string {
  const ts = Date.now();
  // Decompose the 48-bit timestamp into 6 bytes big-endian (safe for any 48-bit value)
  const tsBytes = new Uint8Array(6);
  let t = ts;
  for (let i = 5; i >= 0; i--) {
    tsBytes[i] = t & 0xff;
    t = Math.floor(t / 0x100);
  }
  const tsHex = Array.from(tsBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // randA: 12 bits, with version nibble (7) prepended → 16 bits = 4 hex chars
  const randA = crypto.getRandomValues(new Uint16Array(1))[0] & 0x0fff;
  const randAHex = (0x7000 | randA).toString(16).padStart(4, "0");

  // randB high: variant (10) + 14 random bits → 16 bits = 4 hex chars
  const randBHi = crypto.getRandomValues(new Uint16Array(1))[0];
  const randBWithVar = (randBHi & 0x3fff) | 0x8000;
  const randBHiHex = randBWithVar.toString(16).padStart(4, "0");

  // randB tail: 48 random bits = 6 bytes = 12 hex chars
  const randTail = Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${tsHex.slice(0, 8)}-${tsHex.slice(8, 12)}-${randAHex}-${randBHiHex}-${randTail}`;
}

function generateUuids(version: Version, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(version === "v4" ? crypto.randomUUID() : uuidv7());
  }
  return out;
}

export default function UuidGenerator() {
  const [version, setVersion] = useState<Version>("v4");
  const [count, setCount] = useState(5);
  const [state, setState] = useState<RunState>("idle");
  const [error, setError] = useState<string>();
  const [uuids, setUuids] = useState<string[]>([]);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const run = () => {
    setState("running");
    setError(undefined);
    setUuids([]);
    try {
      const n = Math.max(1, Math.min(500, Math.floor(count || 1)));
      setUuids(generateUuids(version, n));
      setState("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  };

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(uuids.join("\n"));
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1500);
    } catch { /* ignore */ }
  };

  const copyOne = async (idx: number, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch { /* ignore */ }
  };

  return (
    <ClientToolShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label>UUID version</Label>
            <Select value={version} onValueChange={(v) => setVersion(v as Version)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="v4">v4 (random)</SelectItem>
                <SelectItem value="v7">v7 (time-ordered)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="uuid-count">Count (1–500)</Label>
            <Input
              id="uuid-count"
              type="number"
              min={1}
              max={500}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-28"
            />
          </div>
          <Button onClick={run} disabled={state === "running"} className="gap-2">
            <Fingerprint className="h-4 w-4" /> Generate
          </Button>
          <Button variant="ghost" onClick={() => { setUuids([]); setState("idle"); }} className="gap-2">
            <Trash2 className="h-4 w-4" /> Clear
          </Button>
        </div>

        {state === "success" && uuids.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {uuids.length} UUID{uuids.length !== 1 ? "s" : ""} · {version.toUpperCase()}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={run} className="gap-1.5">
                  <RefreshCw className="h-4 w-4" /> Regenerate
                </Button>
                <Button size="sm" variant="outline" onClick={copyAll} className="gap-1.5">
                  {copiedAll ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedAll ? "Copied all" : "Copy all"}
                </Button>
              </div>
            </div>
            <div className="max-h-80 overflow-auto rounded-lg bg-muted p-3">
              <ul className="space-y-1">
                {uuids.map((u, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 rounded px-2 py-1 hover:bg-background/60">
                    <code className="font-mono text-xs break-all">{u}</code>
                    <button
                      onClick={() => copyOne(i, u)}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
                      aria-label={`Copy UUID ${i + 1}`}
                    >
                      {copiedIdx === i ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <ResultPanel state={state} error={error} onReset={() => setState("idle")} />
      </div>
    </ClientToolShell>
  );
}
