'use client'

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileCode, Trash2, Copy, Check } from "lucide-react";
import { marked } from "marked";
import { ClientToolShell } from "@/components/tools/client-tool-shell";
import { ResultPanel, type RunState } from "@/components/tools/result-panel";

// Configure marked synchronously (no async highlighting to keep this purely client-side)
marked.setOptions({
  gfm: true,
  breaks: false,
});

export default function MarkdownToHtml() {
  const [input, setInput] = useState("");
  const [state, setState] = useState<RunState>("idle");
  const [error, setError] = useState<string>();
  const [html, setHtml] = useState("");
  const [copied, setCopied] = useState(false);

  const run = () => {
    setState("running");
    setError(undefined);
    setHtml("");
    try {
      if (!input) throw new Error("Input is empty.");
      const out = marked.parse(input);
      if (typeof out !== "string") {
        throw new Error("Unexpected non-string output from marked.");
      }
      setHtml(out);
      setState("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(html);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <ClientToolShell>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="md-in">Markdown input</Label>
          <Textarea
            id="md-in"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`# Hello NexTool\n\nThis is **bold** and _italic_.\n\n- Item 1\n- Item 2\n\n[Link](https://example.com)`}
            className="min-h-[180px] font-mono text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={run} disabled={!input || state === "running"} className="gap-2">
            <FileCode className="h-4 w-4" /> Render
          </Button>
          <Button variant="ghost" onClick={() => { setInput(""); setHtml(""); setState("idle"); }} className="gap-2">
            <Trash2 className="h-4 w-4" /> Clear
          </Button>
          <p className="ml-auto text-xs text-muted-foreground">GitHub-Flavored Markdown, sync render via <code>marked</code>.</p>
        </div>

        {state === "success" && html && (
          <Tabs defaultValue="preview">
            <div className="mb-2 flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="html">HTML</TabsTrigger>
              </TabsList>
              <Button size="sm" variant="outline" onClick={copy} className="gap-1.5">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy HTML"}
              </Button>
            </div>
            <TabsContent value="preview">
              <div
                className="prose prose-sm dark:prose-invert max-w-none rounded-lg border bg-background p-4"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </TabsContent>
            <TabsContent value="html">
              <pre className="max-h-80 overflow-auto rounded-lg bg-muted p-3 text-xs font-mono whitespace-pre-wrap break-all">{html}</pre>
            </TabsContent>
          </Tabs>
        )}

        <ResultPanel state={state} error={error} onReset={() => setState("idle")} />
      </div>
    </ClientToolShell>
  );
}
