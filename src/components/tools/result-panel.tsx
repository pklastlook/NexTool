'use client'

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Copy, Check, FileText, Loader2, AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatBytes } from "@/lib/tool-engine";

export type RunState = "idle" | "running" | "success" | "error";

interface ResultPanelProps {
  state: RunState;
  error?: string;
  /** Text result */
  text?: string;
  textFilename?: string;
  /** File result (download via /api/download) */
  file?: { key: string; dir: "outputs" | "uploads"; filename: string; mime: string; size: number };
  meta?: Record<string, string | number>;
  onReset?: () => void;
}

export function ResultPanel({
  state, error, text, textFilename, file, meta, onReset,
}: ResultPanelProps) {
  if (state === "idle") return null;

  return (
    <AnimatePresence mode="wait">
      {state === "running" && (
        <motion.div
          key="running"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
        >
          <Card className="border-primary/30">
            <CardContent className="flex items-center gap-3 p-5">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div>
                <p className="font-medium">Processing…</p>
                <p className="text-sm text-muted-foreground">Running the tool for real. This may take a moment.</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {state === "error" && (
        <motion.div
          key="error"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
        >
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{error || "Unknown error."}</AlertDescription>
          </Alert>
        </motion.div>
      )}

      {state === "success" && (
        <motion.div
          key="success"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
        >
          <Card className="border-emerald-500/40">
            <CardContent className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <Check className="h-5 w-5 text-emerald-500" />
                <h3 className="font-semibold">Done</h3>
              </div>

              {text != null && <TextResult text={text} filename={textFilename} />}
              {file && <FileResult file={file} />}

              {meta && Object.keys(meta).length > 0 && (
                <dl className="mt-4 grid grid-cols-2 gap-2 border-t pt-4 text-sm sm:grid-cols-3">
                  {Object.entries(meta).map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{k}</dt>
                      <dd className="font-medium">{typeof v === "number" ? formatBytes(v) : String(v)}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {onReset && (
                <div className="mt-4">
                  <Button variant="outline" size="sm" onClick={onReset} className="gap-1.5">
                    <RotateCcw className="h-4 w-4" /> Run again
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TextResult({ text, filename }: { text: string; filename?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };
  const download = () => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "result.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2">
        <Button size="sm" onClick={copy} className="gap-1.5">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button size="sm" variant="outline" onClick={download} className="gap-1.5">
          <Download className="h-4 w-4" /> Download
        </Button>
      </div>
      <pre className="max-h-80 overflow-auto rounded-lg bg-muted p-3 text-xs">
        {text.length > 20000 ? text.slice(0, 20000) + "\n…(truncated for display)" : text}
      </pre>
    </div>
  );
}

function FileResult({ file }: { file: NonNullable<ResultPanelProps["file"]> }) {
  const href = `/api/download?key=${encodeURIComponent(file.key)}&dir=${file.dir}&filename=${encodeURIComponent(file.filename)}`;
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-4">
      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-background">
        <FileText className="h-5 w-5 text-primary" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{file.filename}</p>
        <p className="text-xs text-muted-foreground">
          {file.mime} · {formatBytes(file.size)}
        </p>
      </div>
      <Button asChild size="sm" className="gap-1.5">
        <a href={href} download={file.filename}>
          <Download className="h-4 w-4" /> Download
        </a>
      </Button>
    </div>
  );
}
