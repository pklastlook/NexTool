'use client'

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Copy, Check, Wand2, Trash2 } from "lucide-react";
import { ClientToolShell } from "@/components/tools/client-tool-shell";
import { ResultPanel, type RunState } from "@/components/tools/result-panel";

type Indent = 2 | 4 | 0;

export default function JsonFormatter() {
  const [input, setInput] = useState("");
  const [indent, setIndent] = useState<Indent>(2);
  const [state, setState] = useState<RunState>("idle");
  const [error, setError] = useState<string>();
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);

  const stats = useMemo(() => {
    if (!output) return null;
    try {
      const parsed = JSON.parse(output);
      const count = countNodes(parsed);
      return { bytes: new Blob([output]).size, nodes: count };
    } catch {
      return null;
    }
  }, [output]);

  const run = () => {
    setState("running");
    setError(undefined);
    setOutput("");
    try {
      const trimmed = input.trim();
      if (!trimmed) throw new Error("Input is empty.");
      const parsed = JSON.parse(trimmed);
      const out = JSON.stringify(parsed, null, indent) + "\n";
      setOutput(out);
      setState("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  };

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
          <Label htmlFor="json-in">JSON input</Label>
          <Textarea
            id="json-in"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`{\n  "hello": "world",\n  "items": [1, 2, 3]\n}`}
            className="min-h-[200px] font-mono text-sm"
          />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>Indent</Label>
            <Select value={String(indent)} onValueChange={(v) => setIndent(Number(v) as Indent)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 spaces</SelectItem>
                <SelectItem value="4">4 spaces</SelectItem>
                <SelectItem value="0">Minified</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={run} disabled={!input.trim() || state === "running"} className="gap-2">
            <Wand2 className="h-4 w-4" /> Format
          </Button>
          <Button variant="ghost" onClick={() => { setInput(""); setOutput(""); setState("idle"); }} className="gap-2">
            <Trash2 className="h-4 w-4" /> Clear
          </Button>
        </div>

        {state === "success" && output && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Valid JSON{stats ? ` · ${stats.nodes} nodes · ${stats.bytes} B` : ""}
              </p>
              <Button size="sm" variant="outline" onClick={copy} className="gap-1.5">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <pre className="max-h-80 overflow-auto rounded-lg bg-muted p-3 text-xs font-mono">{output}</pre>
          </div>
        )}

        <ResultPanel
          state={state}
          error={error}
          onReset={() => setState("idle")}
        />
      </div>
    </ClientToolShell>
  );
}

function countNodes(v: unknown): number {
  if (Array.isArray(v)) return v.reduce((a, x) => a + countNodes(x), 1);
  if (v && typeof v === "object") return Object.values(v as Record<string, unknown>).reduce((a, x) => a + countNodes(x), 1);
  return 1;
}
