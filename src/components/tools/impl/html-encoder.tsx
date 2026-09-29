'use client'

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Code2, Trash2, Copy, Check, ArrowLeftRight } from "lucide-react";
import { ClientToolShell } from "@/components/tools/client-tool-shell";
import { ResultPanel, type RunState } from "@/components/tools/result-panel";

type Mode = "escape" | "unescape";

const ESC_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ESC_MAP[ch] ?? ch);
}

function unescapeHtml(text: string): string {
  const reverse: Array<[RegExp, string]> = [
    [/&amp;/g, "&"],
    [/&lt;/g, "<"],
    [/&gt;/g, ">"],
    [/&quot;/g, '"'],
    [/&#0*39;/g, "'"],
    [/&#x0*27;/gi, "'"],
  ];
  let out = text;
  // First handle numeric entities generically
  out = out.replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)));
  out = out.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
  // Then named entities (after numeric so we don't double-handle)
  for (const [re, replacement] of reverse) {
    out = out.replace(re, replacement);
  }
  return out;
}

export default function HtmlEncoder() {
  const [mode, setMode] = useState<Mode>("escape");
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
      const out = mode === "escape" ? escapeHtml(input) : unescapeHtml(input);
      setOutput(out);
      setState("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  };

  const swap = () => {
    setMode((m) => (m === "escape" ? "unescape" : "escape"));
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
            <TabsTrigger value="escape">Escape</TabsTrigger>
            <TabsTrigger value="unescape">Unescape</TabsTrigger>
          </TabsList>
          <TabsContent value="escape">
            <p className="text-sm text-muted-foreground">Escape <code>&amp;</code>, <code>&lt;</code>, <code>&gt;</code>, <code>&quot;</code>, <code>&#39;</code> into HTML entities.</p>
          </TabsContent>
          <TabsContent value="unescape">
            <p className="text-sm text-muted-foreground">Convert HTML entities (named + numeric) back to characters.</p>
          </TabsContent>
        </Tabs>

        <div className="space-y-1.5">
          <Label htmlFor="html-in">{mode === "escape" ? "Raw text" : "HTML-escaped text"}</Label>
          <Textarea
            id="html-in"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === "escape" ? `<a href="/x?q=1&y=2">Click "here"</a>` : `&lt;a href=&quot;/x?q=1&amp;y=2&quot;&gt;Click &quot;here&quot;&lt;/a&gt;`}
            className="min-h-[150px] font-mono text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={run} disabled={!input || state === "running"} className="gap-2">
            <Code2 className="h-4 w-4" /> {mode === "escape" ? "Escape" : "Unescape"}
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
