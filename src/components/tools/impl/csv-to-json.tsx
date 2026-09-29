'use client'

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Braces, Trash2, Copy, Check } from "lucide-react";
import Papa from "papaparse";
import { ClientToolShell } from "@/components/tools/client-tool-shell";
import { ResultPanel, type RunState } from "@/components/tools/result-panel";

export default function CsvToJson() {
  const [input, setInput] = useState("");
  const [headerRow, setHeaderRow] = useState(true);
  const [dynamicTyping, setDynamicTyping] = useState(true);
  const [state, setState] = useState<RunState>("idle");
  const [error, setError] = useState<string>();
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);

  const run = () => {
    setState("running");
    setError(undefined);
    setOutput("");
    try {
      const trimmed = input.trim();
      if (!trimmed) throw new Error("Input is empty.");
      const result = Papa.parse(trimmed, {
        header: headerRow,
        dynamicTyping,
        skipEmptyLines: true,
      });
      if (result.errors && result.errors.length > 0) {
        const first = result.errors[0];
        throw new Error(`Parse error (row ${first.row ?? "?"}): ${first.message}`);
      }
      const data = result.data;
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("No rows found in CSV input.");
      }
      setOutput(JSON.stringify(data, null, 2));
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

  const rowCount = output ? JSON.parse(output).length : 0;

  return (
    <ClientToolShell>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="csv-in">CSV input</Label>
          <Textarea
            id="csv-in"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`name,age,active\nAlice,30,true\nBob,25,false`}
            className="min-h-[200px] font-mono text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-5">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={headerRow} onCheckedChange={(v) => setHeaderRow(Boolean(v))} />
            First row is header
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={dynamicTyping} onCheckedChange={(v) => setDynamicTyping(Boolean(v))} />
            Dynamic typing (numbers/booleans)
          </label>
          <Button onClick={run} disabled={!input.trim() || state === "running"} className="gap-2 ml-auto">
            <Braces className="h-4 w-4" /> Convert to JSON
          </Button>
          <Button variant="ghost" onClick={() => { setInput(""); setOutput(""); setState("idle"); }} className="gap-2">
            <Trash2 className="h-4 w-4" /> Clear
          </Button>
        </div>

        {state === "success" && output && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                JSON output · {rowCount} record{rowCount !== 1 ? "s" : ""}
              </p>
              <Button size="sm" variant="outline" onClick={copy} className="gap-1.5">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <pre className="max-h-80 overflow-auto rounded-lg bg-muted p-3 text-xs font-mono whitespace-pre-wrap break-all">{output}</pre>
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
