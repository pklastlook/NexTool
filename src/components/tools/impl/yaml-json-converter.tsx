'use client'

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileJson, Trash2, Copy, Check, ArrowLeftRight } from "lucide-react";
import { load as yamlLoad, dump as yamlDump } from "js-yaml";
import { ClientToolShell } from "@/components/tools/client-tool-shell";
import { ResultPanel, type RunState } from "@/components/tools/result-panel";

type Direction = "yaml2json" | "json2yaml";

export default function YamlJsonConverter() {
  const [direction, setDirection] = useState<Direction>("yaml2json");
  const [input, setInput] = useState("");
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
      let out: string;
      if (direction === "yaml2json") {
        const obj = yamlLoad(trimmed);
        out = JSON.stringify(obj, null, 2);
      } else {
        const obj = JSON.parse(trimmed);
        out = yamlDump(obj, { indent: 2, lineWidth: 100, noRefs: true });
      }
      setOutput(out);
      setState("success");
    } catch (e) {
      // js-yaml throws YAMLException with useful .mark info; JSON.parse throws SyntaxError
      setError(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  };

  const swap = () => {
    setDirection((d) => (d === "yaml2json" ? "json2yaml" : "yaml2json"));
    setInput(output);
    setOutput("");
    setState("idle");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  const placeholder =
    direction === "yaml2json"
      ? `name: NexTool\ntags:\n  - dev\n  - tools\nversion: 1.0\nmeta:\n  released: 2025-01-01`
      : `{\n  "name": "NexTool",\n  "tags": ["dev", "tools"],\n  "version": 1.0\n}`;

  return (
    <ClientToolShell>
      <div className="space-y-4">
        <Tabs
          value={direction}
          onValueChange={(v) => { setDirection(v as Direction); setState("idle"); setOutput(""); }}
        >
          <TabsList>
            <TabsTrigger value="yaml2json">YAML → JSON</TabsTrigger>
            <TabsTrigger value="json2yaml">JSON → YAML</TabsTrigger>
          </TabsList>
          <TabsContent value="yaml2json">
            <p className="text-sm text-muted-foreground">Parse YAML via <code>js-yaml</code> and stringify to JSON.</p>
          </TabsContent>
          <TabsContent value="json2yaml">
            <p className="text-sm text-muted-foreground">Parse JSON and dump to YAML via <code>js-yaml</code>.</p>
          </TabsContent>
        </Tabs>

        <div className="space-y-1.5">
          <Label htmlFor="yj-in">{direction === "yaml2json" ? "YAML input" : "JSON input"}</Label>
          <Textarea
            id="yj-in"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            className="min-h-[200px] font-mono text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={run} disabled={!input.trim() || state === "running"} className="gap-2">
            <FileJson className="h-4 w-4" /> Convert
          </Button>
          <Button variant="outline" onClick={swap} className="gap-2">
            <ArrowLeftRight className="h-4 w-4" /> Swap direction
          </Button>
          <Button variant="ghost" onClick={() => { setInput(""); setOutput(""); setState("idle"); }} className="gap-2">
            <Trash2 className="h-4 w-4" /> Clear
          </Button>
        </div>

        {state === "success" && output && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {direction === "yaml2json" ? "JSON output" : "YAML output"} · {new Blob([output]).size} B
              </p>
              <Button size="sm" variant="outline" onClick={copy} className="gap-1.5">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-3 text-xs font-mono whitespace-pre-wrap break-all">{output}</pre>
          </div>
        )}

        <ResultPanel state={state} error={error} onReset={() => setState("idle")} />
      </div>
    </ClientToolShell>
  );
}
