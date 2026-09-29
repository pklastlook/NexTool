'use client'

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Clock, Trash2, Copy, Check, ArrowLeftRight } from "lucide-react";
import { ClientToolShell } from "@/components/tools/client-tool-shell";
import { ResultPanel, type RunState } from "@/components/tools/result-panel";

// Convert a Date to a "YYYY-MM-DDTHH:mm" string suitable for <input type="datetime-local">
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export default function UnixTimestampConverter() {
  const [tab, setTab] = useState<"ts2date" | "date2ts">("ts2date");

  // ts -> date
  const [tsInput, setTsInput] = useState("");
  const [tsUnit, setTsUnit] = useState<"s" | "ms">("s");
  const [tsResult, setTsResult] = useState<string>("");

  // date -> ts
  const [dateInput, setDateInput] = useState(toLocalInput(new Date()));

  // state machine for whichever conversion last ran
  const [state, setState] = useState<RunState>("idle");
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState<string | null>(null);

  // Live "now" clock
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const nowSec = Math.floor(now / 1000);

  const tsResultMs = useMemo(() => {
    if (!tsResult) return null;
    const n = Number(tsResult);
    return isNaN(n) ? null : n;
  }, [tsResult]);

  const runTs2Date = () => {
    setState("running");
    setError(undefined);
    setTsResult("");
    try {
      const n = Number(tsInput.trim());
      if (tsInput.trim() === "" || isNaN(n)) throw new Error("Enter a valid Unix timestamp number.");
      const ms = tsUnit === "s" ? n * 1000 : n;
      const d = new Date(ms);
      if (isNaN(d.getTime())) throw new Error("Out-of-range timestamp.");
      setTsResult(String(ms));
      setState("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  };

  const runDate2Ts = () => {
    setState("running");
    setError(undefined);
    try {
      const d = fromLocalInput(dateInput);
      if (!d) throw new Error("Pick a valid date and time.");
      const ms = d.getTime();
      setTsResult(String(ms));
      setState("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  };

  const useNow = () => {
    setTab("date2ts");
    setDateInput(toLocalInput(new Date()));
    setTsResult(String(Date.now()));
    setState("success");
    setError(undefined);
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
      <div className="space-y-4">
        {/* Live current-time strip */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 p-3">
          <Clock className="h-4 w-4 text-primary" />
          <div className="text-sm">
            <span className="text-muted-foreground">Current Unix time:</span>{" "}
            <button
              onClick={() => copyValue("now", String(nowSec))}
              className="font-mono font-medium hover:underline"
              title="Click to copy"
            >
              {nowSec}
            </button>
            <span className="ml-1 text-xs text-muted-foreground">sec</span>
            <span className="mx-2 text-muted-foreground">·</span>
            <span className="text-muted-foreground">{new Date(now).toLocaleString()}</span>
          </div>
          <Button size="sm" variant="outline" onClick={useNow} className="ml-auto gap-1.5">
            <ArrowLeftRight className="h-4 w-4" /> Use now
          </Button>
        </div>

        <Tabs value={tab} onValueChange={(v) => { setTab(v as typeof tab); setState("idle"); setTsResult(""); }}>
          <TabsList>
            <TabsTrigger value="ts2date">Timestamp → Date</TabsTrigger>
            <TabsTrigger value="date2ts">Date → Timestamp</TabsTrigger>
          </TabsList>

          <TabsContent value="ts2date" className="space-y-3 pt-2">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ts-in">Unix timestamp</Label>
                <Input
                  id="ts-in"
                  value={tsInput}
                  onChange={(e) => setTsInput(e.target.value)}
                  placeholder="1697040000"
                  className="w-48 font-mono"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <div className="flex h-9 overflow-hidden rounded-md border">
                  {(["s", "ms"] as const).map((u) => (
                    <button
                      key={u}
                      onClick={() => setTsUnit(u)}
                      className={`px-3 text-sm font-medium transition-colors ${
                        tsUnit === u ? "bg-primary text-primary-foreground" : "bg-transparent hover:bg-muted"
                      }`}
                    >
                      {u === "s" ? "seconds" : "milliseconds"}
                    </button>
                  ))}
                </div>
              </div>
              <Button onClick={runTs2Date} disabled={!tsInput.trim() || state === "running"} className="gap-2">
                <Clock className="h-4 w-4" /> Convert
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="date2ts" className="space-y-3 pt-2">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="date-in">Date &amp; time (local)</Label>
                <Input
                  id="date-in"
                  type="datetime-local"
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  className="w-64"
                />
              </div>
              <Button onClick={runDate2Ts} disabled={state === "running"} className="gap-2">
                <Clock className="h-4 w-4" /> Convert
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {state === "success" && tsResultMs !== null && (
          <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <ResultRow label="Unix (seconds)" value={String(Math.floor(tsResultMs / 1000))} onCopy={() => copyValue("s", String(Math.floor(tsResultMs / 1000)))} copied={copied === "s"} />
              <ResultRow label="Unix (milliseconds)" value={String(tsResultMs)} onCopy={() => copyValue("ms", String(tsResultMs))} copied={copied === "ms"} />
              <ResultRow label="UTC (ISO 8601)" value={new Date(tsResultMs).toISOString()} onCopy={() => copyValue("iso", new Date(tsResultMs).toISOString())} copied={copied === "iso"} />
              <ResultRow label="Local time" value={new Date(tsResultMs).toLocaleString()} onCopy={() => copyValue("local", new Date(tsResultMs).toLocaleString())} copied={copied === "local"} />
            </div>
          </div>
        )}

        <div className="flex">
          <Button variant="ghost" size="sm" onClick={() => { setTsInput(""); setTsResult(""); setState("idle"); }} className="gap-1.5">
            <Trash2 className="h-4 w-4" /> Clear
          </Button>
        </div>

        <ResultPanel state={state} error={error} onReset={() => setState("idle")} />
      </div>
    </ClientToolShell>
  );
}

function ResultRow({ label, value, onCopy, copied }: { label: string; value: string; onCopy: () => void; copied: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded bg-background px-2 py-1 font-mono text-sm">{value}</code>
        <Button size="icon" variant="ghost" onClick={onCopy} aria-label={`Copy ${label}`}>
          {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
