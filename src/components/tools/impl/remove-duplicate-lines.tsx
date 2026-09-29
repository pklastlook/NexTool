'use client'

import { useMemo, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Copy, Check, Trash2 } from "lucide-react";
import { ClientToolShell } from "@/components/tools/client-tool-shell";

export default function RemoveDuplicateLines() {
  const [text, setText] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(true);
  const [trimWhitespace, setTrimWhitespace] = useState(true);
  const [keepEmpty, setKeepEmpty] = useState(false);
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => {
    const lines = text.split(/\r?\n/);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of lines) {
      let key = raw;
      let display = raw;
      if (trimWhitespace) {
        display = raw.trim();
        key = display;
      }
      if (!keepEmpty && display === "") continue;
      const lookupKey = caseSensitive ? key : key.toLowerCase();
      if (seen.has(lookupKey)) continue;
      seen.add(lookupKey);
      out.push(display);
    }
    const removed = lines.length - out.length;
    return { output: out.join("\n"), removed, total: lines.length, unique: out.length };
  }, [text, caseSensitive, trimWhitespace, keepEmpty]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <ClientToolShell>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="rdl-in">Input lines</Label>
          <Textarea
            id="rdl-in"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"apple\nbanana\napple\ncherry\nbanana"}
            className="min-h-[180px] font-mono text-sm"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <OptionRow
            label="Case-sensitive"
            checked={caseSensitive}
            onChange={setCaseSensitive}
            hint="Treat “Apple” and “apple” as different"
          />
          <OptionRow
            label="Trim whitespace"
            checked={trimWhitespace}
            onChange={setTrimWhitespace}
            hint="Ignore leading/trailing spaces"
          />
          <OptionRow
            label="Keep empty lines"
            checked={keepEmpty}
            onChange={setKeepEmpty}
            hint="Preserve blank lines"
          />
        </div>

        {text && (
          <div className="flex flex-wrap gap-3 text-sm">
            <Badge label="Input lines" value={result.total} />
            <Badge label="Unique lines" value={result.unique} />
            <Badge label="Removed" value={result.removed} highlight />
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Unique output</Label>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={copy} disabled={!result.output} className="gap-1.5">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setText("")} disabled={!text} className="gap-1.5">
                <Trash2 className="h-4 w-4" /> Clear
              </Button>
            </div>
          </div>
          <pre className="min-h-[140px] overflow-auto rounded-lg bg-muted p-3 font-mono text-sm whitespace-pre-wrap break-words">
            {result.output || <span className="text-muted-foreground">Unique lines will appear here…</span>}
          </pre>
        </div>
      </div>
    </ClientToolShell>
  );
}

function OptionRow({
  label, checked, onChange, hint,
}: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Badge({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded-md border px-3 py-1.5 ${highlight ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300" : ""}`}>
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value.toLocaleString()}</span>
    </div>
  );
}
