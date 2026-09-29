'use client'

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Binary, Trash2, Copy, Check, ArrowLeftRight } from "lucide-react";
import { ClientToolShell } from "@/components/tools/client-tool-shell";
import { ResultPanel, type RunState } from "@/components/tools/result-panel";

type Mode = "encode" | "decode";

// UTF-8 safe Base64 encode
function encodeB64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

// UTF-8 safe Base64 decode
function decodeB64(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export default function Base64Encoder() {
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
      const out = mode === "encode" ? encodeB64(input) : decodeB64(input.trim());
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
            <p className="text-sm text-muted-foreground">Convert text to a Base64 string (UTF-8 safe).</p>
          </TabsContent>
          <TabsContent value="decode">
            <p className="text-sm text-muted-foreground">Decode a Base64 string back to text (UTF-8 safe).</p>
          </TabsContent>
        </Tabs>

        <div className="space-y-1.5">
          <Label htmlFor="b64-in">{mode === "encode" ? "Plain text" : "Base64 input"}</Label>
          <Textarea
            id="b64-in"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === "encode" ? "Hello, NexTool! 👋" : "SGVsbG8sIE5leFRvb2whIPCfkYs="}
            className="min-h-[150px] font-mono text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={run} disabled={!input || state === "running"} className="gap-2">
            <Binary className="h-4 w-4" /> {mode === "encode" ? "Encode" : "Decode"}
          </Button>
          <Button variant="outline" onClick={swap} className="gap-2" title="Use result as new input and switch direction">
            <ArrowLeftRight className="h-4 w-4" /> Swap
          </Button>
          <Button variant="ghost" onClick={() => { setInput(""); setOutput(""); setState("idle"); }} className="gap-2">
            <Trash2 className="h-4 w-4" /> Clear
          </Button>
        </div>

        {state === "success" && output && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {mode === "encode" ? "Base64" : "Decoded text"} · {new Blob([output]).size} B
              </p>
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
