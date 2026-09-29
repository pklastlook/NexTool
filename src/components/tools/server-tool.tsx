'use client'

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDropzone } from "@/components/tools/file-dropzone";
import { ResultPanel, type RunState } from "@/components/tools/result-panel";
import { type ToolDef } from "@/lib/tool-registry";
import { formatBytes } from "@/lib/tool-engine";

interface ServerToolProps {
  tool: ToolDef;
  /** API path to POST FormData to, e.g. /api/process/image-compress */
  apiPath: string;
  accept: string;
  optionsRenderer?: React.ReactNode;
  /** Hidden fields sent with the request */
  extraFields?: Record<string, string>;
}

/**
 * Generic server tool wrapper for file-upload -> process -> download tools.
 * Used by image/pdf/office/ocr/media tools that don't need bespoke UI.
 */
export function ServerTool({ tool, apiPath, accept, optionsRenderer, extraFields }: ServerToolProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<RunState>("idle");
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<{
    text?: string; textFilename?: string;
    file?: { key: string; dir: "outputs" | "uploads"; filename: string; mime: string; size: number };
    meta?: Record<string, string | number>;
  }>({});

  const run = async () => {
    if (files.length === 0) return;
    setState("running");
    setError(undefined);
    try {
      const fd = new FormData();
      files.forEach((f, i) => fd.append(`file${i}`, f));
      if (extraFields) {
        for (const [k, v] of Object.entries(extraFields)) fd.append(k, v);
      }
      const res = await fetch(apiPath, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Processing failed (HTTP ${res.status}).`);
      }
      setResult(data);
      setState("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  };

  const reset = () => {
    setState("idle");
    setFiles([]);
    setResult({});
  };

  return (
    <div className="space-y-5">
      <FileDropzone
        accept={accept}
        maxSize={tool.maxFileSize ?? 10485760}
        multiple={false}
        onFiles={setFiles}
        selected={files}
        onRemove={(i) => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
      />

      {optionsRenderer}

      <Button onClick={run} disabled={files.length === 0 || state === "running"} size="lg" className="gap-2">
        {state === "running" ? "Processing…" : "Run tool"}
      </Button>

      <ResultPanel
        state={state}
        error={error}
        text={result.text}
        textFilename={result.textFilename}
        file={result.file}
        meta={result.meta}
        onReset={reset}
      />

      {files.length > 0 && state === "idle" && (
        <p className="text-xs text-muted-foreground">
          Selected: {files.map((f) => `${f.name} (${formatBytes(f.size)})`).join(", ")}
        </p>
      )}
    </div>
  );
}
