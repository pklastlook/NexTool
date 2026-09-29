'use client'

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Link2, Trash2, Copy, Check, ArrowLeftRight } from "lucide-react";
import { ClientToolShell } from "@/components/tools/client-tool-shell";
import { ResultPanel, type RunState } from "@/components/tools/result-panel";

type Mode = "encode" | "decode";

export default function UrlEncoder() {
  const [mode, setMode] = useState<Mode>("encode");
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
      if (!input) throw new Error("Input is empty.");
      const out = mode === "encode"
        ? encodeURIComponent(input)
        : decodeURIComponent(input);
      setOutput(out);
      setState("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  };

  const swap = () => {
    setMode((m) => (m === "encode" ? "decode" : "encode"));
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

  return (
    <ClientToolShell>
      <div className="space-y-4">
        <Tabs value={mode} onValueChange={(v) => { setMode(v as Mode); setState("idle"); setOutput(""); }}>
          <TabsList>
            <TabsTrigger value="encode">Encode</TabsTrigger>
            <TabsTrigger value="decode">Decode</TabsTrigger>
          </TabsList>
          <TabsContent value="encode">
            <p className="text-sm text-muted-foreground">Percent-encode a URL component using <code>encodeURIComponent</code>.</p>
          </TabsContent>
          <TabsContent value="decode">
            <p className="text-sm text-muted-foreground">Decode a percent-encoded URL component using <code>decodeURIComponent</code>.</p>
          </TabsContent>
        </Tabs>

        <div className="space-y-1.5">
          <Label htmlFor="url-in">{mode === "encode" ? "Plain text" : "Encoded text"}</Label>
          <Textarea
            id="url-in"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === "encode" ? "https://example.com/?q=hello world&lang=en" : "https%3A%2F%2Fexample.com%2F%3Fq%3Dhello%20world%26lang%3Den"}
            className="min-h-[150px] font-mono text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={run} disabled={!input || state === "running"} className="gap-2">
            <Link2 className="h-4 w-4" /> {mode === "encode" ? "Encode" : "Decode"}
          </Button>
          <Button variant="outline" onClick={swap} className="gap-2">
            <ArrowLeftRight className="h-4 w-4" /> Swap
          </Button>
          <Button variant="ghost" onClick={() => { setInput(""); setOutput(""); setState("idle"); }} className="gap-2">
            <Trash2 className="h-4 w-4" /> Clear
          </Button>
        </div>

        {state === "success" && output && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{new Blob([output]).size} B</p>
              <Button size="sm" variant="outline" onClick={copy} className="gap-1.5">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <pre className="max-h-80 overflow-auto rounded-lg bg-muted p-3 text-xs font-mono whitespace-pre-wrap break-all">{output}</pre>
          </div>
        )}

        <ResultPanel state={state} error={error} onReset={() => setState("idle")} />
      </div>
    </ClientToolShell>
  );
}
