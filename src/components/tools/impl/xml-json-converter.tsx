'use client'

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileCode2, Trash2, Copy, Check, ArrowLeftRight } from "lucide-react";
import { XMLParser, XMLBuilder } from "fast-xml-parser";
import { ClientToolShell } from "@/components/tools/client-tool-shell";
import { ResultPanel, type RunState } from "@/components/tools/result-panel";

type Direction = "xml2json" | "json2xml";

export default function XmlJsonConverter() {
  const [direction, setDirection] = useState<Direction>("xml2json");
  const [input, setInput] = useState("");
  const [state, setState] = useState<RunState>("idle");
  const [error, setError] = useState<string>();
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);
  const [attrPrefix, setAttrPrefix] = useState(true);
  const [format, setFormat] = useState(true);

  const run = () => {
    setState("running");
    setError(undefined);
    setOutput("");
    try {
      const trimmed = input.trim();
      if (!trimmed) throw new Error("Input is empty.");
      let out: string;

      if (direction === "xml2json") {
        const parser = new XMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: attrPrefix ? "@" : "",
          removeNSPrefix: true,
          parseAttributeValue: true,
          parseTagValue: true,
          trimValues: true,
        });
        const obj = parser.parse(trimmed);
        out = JSON.stringify(obj, null, format ? 2 : 0);
      } else {
        const obj = JSON.parse(trimmed);
        const builder = new XMLBuilder({
          ignoreAttributes: false,
          attributeNamePrefix: attrPrefix ? "@" : "",
          format,
          indentBy: "  ",
          suppressBooleanAttributes: false,
        });
        out = builder.build(obj);
      }
      setOutput(out);
      setState("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  };

  const swap = () => {
    setDirection((d) => (d === "xml2json" ? "json2xml" : "xml2json"));
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
    direction === "xml2json"
      ? `<?xml version="1.0"?>\n<note>\n  <to>Tove</to>\n  <from>Jani</from>\n  <heading>Reminder</heading>\n  <body>Don't forget me!</body>\n</note>`
      : `{\n  "note": {\n    "to": "Tove",\n    "from": "Jani",\n    "heading": "Reminder",\n    "body": "Don't forget me!"\n  }\n}`;

  return (
    <ClientToolShell>
      <div className="space-y-4">
        <Tabs
          value={direction}
          onValueChange={(v) => { setDirection(v as Direction); setState("idle"); setOutput(""); }}
        >
          <TabsList>
            <TabsTrigger value="xml2json">XML → JSON</TabsTrigger>
            <TabsTrigger value="json2xml">JSON → XML</TabsTrigger>
          </TabsList>
          <TabsContent value="xml2json">
            <p className="text-sm text-muted-foreground">Parse XML via <code>fast-xml-parser</code> into a JSON object.</p>
          </TabsContent>
          <TabsContent value="json2xml">
            <p className="text-sm text-muted-foreground">Build XML from a JSON object via <code>fast-xml-parser</code>.</p>
          </TabsContent>
        </Tabs>

        <div className="space-y-1.5">
          <Label htmlFor="xj-in">{direction === "xml2json" ? "XML input" : "JSON input"}</Label>
          <Textarea
            id="xj-in"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            className="min-h-[200px] font-mono text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-5">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={attrPrefix} onCheckedChange={(v) => setAttrPrefix(Boolean(v))} />
            Use <code>@</code> prefix for attributes
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={format} onCheckedChange={(v) => setFormat(Boolean(v))} />
            Pretty-print output
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={run} disabled={!input.trim() || state === "running"} className="gap-2">
            <FileCode2 className="h-4 w-4" /> Convert
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
                {direction === "xml2json" ? "JSON output" : "XML output"} · {new Blob([output]).size} B
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
