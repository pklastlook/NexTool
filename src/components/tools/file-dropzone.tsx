'use client'

import { useCallback, useRef, useState } from "react";
import { UploadCloud, X, FileIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/tool-engine";

interface FileDropzoneProps {
  accept: string; // e.g. ".pdf,.docx"
  maxSize: number; // bytes
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  selected: File[];
  onRemove?: (index: number) => void;
  label?: string;
}

export function FileDropzone({
  accept, maxSize, multiple, onFiles, selected, onRemove, label,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleFiles = useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return;
      setErr(null);
      const files = Array.from(list);
      // Validate size client-side (server re-validates)
      const tooBig = files.find((f) => f.size > maxSize);
      if (tooBig) {
        setErr(`"${tooBig.name}" exceeds the ${(maxSize / 1048576).toFixed(0)} MB limit.`);
      }
      onFiles(multiple ? files : [files[0]]);
    },
    [maxSize, multiple, onFiles]
  );

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 cursor-pointer transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/60 hover:bg-muted/40"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <UploadCloud className="h-8 w-8 text-muted-foreground" />
        <div className="text-center">
          <p className="font-medium">{dragging ? "Drop to upload" : (label ?? "Click to browse or drop a file")}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {accept.split(",").join(" · ").toUpperCase()} · max {(maxSize / 1048576).toFixed(0)} MB
          </p>
        </div>
      </div>

      {err && <p className="mt-2 text-sm text-destructive">{err}</p>}

      {selected.length > 0 && (
        <ul className="mt-3 space-y-2">
          {selected.map((f, i) => (
            <li key={i} className="flex items-center gap-3 rounded-lg border bg-card p-3">
              <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{f.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(f.size)}</p>
              </div>
              {onRemove && (
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onRemove(i)} aria-label="Remove">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
