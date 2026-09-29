'use client'

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Copy, Check, Wand2, Trash2 } from "lucide-react";
import { ClientToolShell } from "@/components/tools/client-tool-shell";

// Classic Lorem Ipsum word pool (de-Latinate, used as the canonical filler text).
const WORDS = [
  "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit",
  "sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore",
  "magna", "aliqua", "enim", "ad", "minim", "veniam", "quis", "nostrud",
  "exercitation", "ullamco", "laboris", "nisi", "aliquip", "ex", "ea", "commodo",
  "consequat", "duis", "aute", "irure", "in", "reprehenderit", "voluptate",
  "velit", "esse", "cillum", "fugiat", "nulla", "pariatur", "excepteur", "sint",
  "occaecat", "cupidatat", "non", "proident", "sunt", "culpa", "qui", "officia",
  "deserunt", "mollit", "anim", "id", "est", "laborum", "at", "vero", "eos",
  "accusamus", "iusto", "odio", "dignissimos", "ducimus", "blanditiis",
  "praesentium", "voluptatum", "deleniti", "atque", "corrupti", "quos", "quas",
  "quasi", "harum", "quidem", "rerum", "facilis", "expedita", "distinctio",
  "nam", "libero", "tempore", "cum", "soluta", "nobis", "eligendi", "optio",
  "cumque", "nihil", "impedit", "quo", "minus", "id", "quod", "maxime",
  "placeat", "facere", "possimus", "omnis", "voluptas", "assumenda", "est",
  "omnis", "repellendus", "temporibus", "autem", "quibusdam", "et", "aut",
  "officiis", "debitis", "aut", "rerum", "necessitatibus", "saepe", "eveniet",
];

type Unit = "paragraphs" | "sentences" | "words";

function rand(n: number) { return Math.floor(Math.random() * n); }

function makeSentence(minWords = 6, maxWords = 16): string {
  const len = minWords + rand(maxWords - minWords + 1);
  const words: string[] = [];
  for (let i = 0; i < len; i++) words.push(WORDS[rand(WORDS.length)]);
  words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  // Occasionally insert a comma mid-sentence for variety.
  if (len > 8) {
    const commaPos = 3 + rand(len - 6);
    words[commaPos] = words[commaPos] + ",";
  }
  return words.join(" ") + ".";
}

function makeParagraph(minSent = 3, maxSent = 6): string {
  const len = minSent + rand(maxSent - minSent + 1);
  const sents: string[] = [];
  for (let i = 0; i < len; i++) sents.push(makeSentence());
  return sents.join(" ");
}

export default function LoremIpsumGenerator() {
  const [count, setCount] = useState(3);
  const [unit, setUnit] = useState<Unit>("paragraphs");
  const [startClassic, setStartClassic] = useState(true);
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);

  const generate = () => {
    let result = "";
    const n = Math.max(1, Math.min(100, count));

    if (unit === "words") {
      const words: string[] = [];
      for (let i = 0; i < n; i++) words.push(WORDS[rand(WORDS.length)]);
      if (startClassic) {
        words[0] = "lorem";
        if (words.length > 1) words[1] = "ipsum";
      }
      words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
      result = words.join(" ");
    } else if (unit === "sentences") {
      const sents: string[] = [];
      for (let i = 0; i < n; i++) sents.push(makeSentence());
      if (startClassic) {
        sents[0] = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";
      }
      result = sents.join(" ");
    } else {
      const paras: string[] = [];
      for (let i = 0; i < n; i++) paras.push(makeParagraph());
      if (startClassic) {
        paras[0] = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.";
      }
      result = paras.join("\n\n");
    }
    setOutput(result);
  };

  const wordCount = useMemo(() => (output ? output.trim().split(/\s+/).filter(Boolean).length : 0), [output]);

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
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Count: {count}</Label>
            <Slider
              min={1}
              max={100}
              step={1}
              value={[count]}
              onValueChange={(v) => setCount(v[0] ?? 1)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Unit</Label>
            <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="paragraphs">Paragraphs</SelectItem>
                <SelectItem value="sentences">Sentences</SelectItem>
                <SelectItem value="words">Words</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Start with “Lorem ipsum”</p>
            <p className="text-xs text-muted-foreground">Use the classic opening phrase.</p>
          </div>
          <Switch checked={startClassic} onCheckedChange={setStartClassic} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={generate} className="gap-2">
            <Wand2 className="h-4 w-4" /> Generate
          </Button>
          <Button variant="ghost" onClick={() => setOutput("")} disabled={!output} className="gap-2">
            <Trash2 className="h-4 w-4" /> Clear
          </Button>
        </div>

        {output && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{wordCount.toLocaleString()} words</p>
              <Button size="sm" variant="outline" onClick={copy} className="gap-1.5">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <pre className="max-h-80 overflow-auto rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap break-words leading-relaxed">
              {output}
            </pre>
          </div>
        )}
      </div>
    </ClientToolShell>
  );
}
