'use client';

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, ImageIcon, Wand2, Trash2 } from "lucide-react";
import { ClientToolShell } from "@/components/tools/client-tool-shell";
import { ResultPanel, type RunState } from "@/components/tools/result-panel";

type FormatKey = "post" | "story" | "portrait" | "landscape";

const FORMATS: Record<FormatKey, { name: string; width: number; height: number; ratio: string; desc: string }> = {
  post: { name: "Square Post", width: 1080, height: 1080, ratio: "1:1", desc: "Feed post" },
  story: { name: "Story / Reel", width: 1080, height: 1920, ratio: "9:16", desc: "Story / Reel cover" },
  portrait: { name: "Portrait", width: 1080, height: 1350, ratio: "4:5", desc: "Feed portrait" },
  landscape: { name: "Landscape", width: 1080, height: 566, ratio: "1.91:1", desc: "Landscape cover" },
};

export default function InstagramImageResizer() {
  const [format, setFormat] = useState<FormatKey>("post");
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [origName, setOrigName] = useState<string>("");
  const [origDims, setOrigDims] = useState<{ w: number; h: number } | null>(null);
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [outDims, setOutDims] = useState<{ w: number; h: number } | null>(null);
  const [state, setState] = useState<RunState>("idle");
  const [error, setError] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (file: File) => {
    setError(undefined);
    setState("idle");
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (PNG, JPG, WEBP).");
      setState("error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        setImg(image);
        setOrigName(file.name);
        setOrigDims({ w: image.naturalWidth, h: image.naturalHeight });
        setOutUrl(null);
        setOutDims(null);
        setState("idle");
      };
      image.onerror = () => {
        setError("Could not decode that image. Try another file.");
        setState("error");
      };
      image.src = reader.result as string;
    };
    reader.onerror = () => {
      setError("Failed to read file.");
      setState("error");
    };
    reader.readAsDataURL(file);
  };

  const resize = () => {
    if (!img) {
      setError("Upload an image first.");
      setState("error");
      return;
    }
    setState("running");
    setError(undefined);
    try {
      const spec = FORMATS[format];
      const canvas = document.createElement("canvas");
      canvas.width = spec.width;
      canvas.height = spec.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported in this browser.");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, spec.width, spec.height);

      // object-fit: cover math
      const srcW = img.naturalWidth;
      const srcH = img.naturalHeight;
      const srcRatio = srcW / srcH;
      const dstRatio = spec.width / spec.height;
      let sx = 0, sy = 0, sw = srcW, sh = srcH;
      if (srcRatio > dstRatio) {
        // source is wider — crop horizontally
        sw = srcH * dstRatio;
        sx = (srcW - sw) / 2;
      } else if (srcRatio < dstRatio) {
        // source is taller — crop vertically
        sh = srcW / dstRatio;
        sy = (srcH - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, spec.width, spec.height);

      canvas.toBlob((blob) => {
        if (!blob) {
          setError("Failed to render image.");
          setState("error");
          return;
        }
        const url = URL.createObjectURL(blob);
        setOutUrl(url);
        setOutDims({ w: spec.width, h: spec.height });
        setState("success");
      }, "image/png");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  };

  const download = () => {
    if (!outUrl) return;
    const a = document.createElement("a");
    a.href = outUrl;
    const base = origName.replace(/\.[^.]+$/, "") || "image";
    a.download = `${base}-instagram-${format}-${FORMATS[format].width}x${FORMATS[format].height}.png`;
    a.click();
  };

  const reset = () => {
    setImg(null);
    setOrigName("");
    setOrigDims(null);
    setOutUrl(null);
    setOutDims(null);
    setState("idle");
    setError(undefined);
    if (fileRef.current) fileRef.current.value = "";
  };

  const spec = FORMATS[format];

  return (
    <ClientToolShell>
      <div className="space-y-5">
        <Tabs value={format} onValueChange={(v) => { setFormat(v as FormatKey); setOutUrl(null); setOutDims(null); setState("idle"); }}>
          <div className="overflow-x-auto">
            <TabsList>
              {(Object.keys(FORMATS) as FormatKey[]).map((k) => (
                <TabsTrigger key={k} value={k} className="gap-1.5">
                  {FORMATS[k].name}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>

        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">{spec.name}</p>
              <p className="text-sm text-muted-foreground">
                {spec.width} × {spec.height}px · {spec.ratio} · {spec.desc}
              </p>
            </div>
            <Badge variant="secondary">PNG output</Badge>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Upload image</Label>
          <div
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) onFile(f);
            }}
            className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/20 p-8 text-center transition-colors hover:border-primary/50"
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Drop image here or click to browse</p>
              <p className="text-sm text-muted-foreground">PNG / JPG / WEBP</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
            />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5">
              <ImageIcon className="h-4 w-4" /> Choose file
            </Button>
          </div>
        </div>

        {origDims && (
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="gap-1.5">
              Original · {origName}
              <span className="text-muted-foreground">{origDims.w}×{origDims.h}</span>
            </Badge>
            <Button onClick={resize} disabled={state === "running"} className="gap-2">
              <Wand2 className="h-4 w-4" /> Resize to {spec.width}×{spec.height}
            </Button>
            <Button variant="ghost" onClick={reset} className="gap-2">
              <Trash2 className="h-4 w-4" /> Reset
            </Button>
          </div>
        )}

        {outUrl && outDims && (
          <div className="space-y-3 rounded-lg border bg-background p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Output: <span className="font-medium text-foreground">{outDims.w}×{outDims.h}px</span>
                {" → "}Instagram {spec.name}
              </p>
              <Button size="sm" onClick={download} className="gap-1.5">
                <Download className="h-4 w-4" /> Download PNG
              </Button>
            </div>
            <div className="flex justify-center rounded-md bg-muted/40 p-3">
              { }
              <img
                src={outUrl}
                alt="Resized output"
                className="max-h-[420px] max-w-full rounded-md shadow-sm"
                style={{ objectFit: "contain" }}
              />
            </div>
          </div>
        )}

        <ResultPanel state={state} error={error} onReset={() => setState("idle")} />
      </div>
    </ClientToolShell>
  );
}
