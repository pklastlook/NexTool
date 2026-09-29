'use client';

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Upload, Download, Youtube, Wand2, Trash2 } from "lucide-react";
import { ClientToolShell } from "@/components/tools/client-tool-shell";
import { ResultPanel, type RunState } from "@/components/tools/result-panel";

const YT_W = 1280;
const YT_H = 720;

export default function YoutubeThumbnailMaker() {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [origName, setOrigName] = useState<string>("");
  const [origDims, setOrigDims] = useState<{ w: number; h: number } | null>(null);
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [cover, setCover] = useState<boolean>(true);
  const [bgColor, setBgColor] = useState<string>("#000000");
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
      const canvas = document.createElement("canvas");
      canvas.width = YT_W;
      canvas.height = YT_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported in this browser.");
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, YT_W, YT_H);

      const srcW = img.naturalWidth;
      const srcH = img.naturalHeight;

      if (cover) {
        // object-fit: cover
        const srcRatio = srcW / srcH;
        const dstRatio = YT_W / YT_H;
        let sx = 0, sy = 0, sw = srcW, sh = srcH;
        if (srcRatio > dstRatio) {
          sw = srcH * dstRatio;
          sx = (srcW - sw) / 2;
        } else if (srcRatio < dstRatio) {
          sh = srcW / dstRatio;
          sy = (srcH - sh) / 2;
        }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, YT_W, YT_H);
      } else {
        // object-fit: contain (letterboxed on bg color)
        const scale = Math.min(YT_W / srcW, YT_H / srcH);
        const dw = srcW * scale;
        const dh = srcH * scale;
        const dx = (YT_W - dw) / 2;
        const dy = (YT_H - dh) / 2;
        ctx.drawImage(img, 0, 0, srcW, srcH, dx, dy, dw, dh);
      }

      canvas.toBlob((blob) => {
        if (!blob) {
          setError("Failed to render image.");
          setState("error");
          return;
        }
        const url = URL.createObjectURL(blob);
        setOutUrl(url);
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
    const base = origName.replace(/\.[^.]+$/, "") || "thumbnail";
    a.download = `${base}-youtube-thumbnail-1280x720.png`;
    a.click();
  };

  const reset = () => {
    setImg(null);
    setOrigName("");
    setOrigDims(null);
    setOutUrl(null);
    setState("idle");
    setError(undefined);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <ClientToolShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center gap-3">
            <Youtube className="h-8 w-8 text-red-600" />
            <div>
              <p className="font-medium">YouTube Thumbnail · 1280 × 720</p>
              <p className="text-sm text-muted-foreground">16:9 · max 2 MB recommended · PNG output</p>
            </div>
          </div>
          <Badge variant="secondary">Spec compliant</Badge>
        </div>

        <div className="space-y-1.5">
          <Label>Upload image</Label>
          <div
            onDragOver={(e) => e.preventDefault()}
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
              <Upload className="h-4 w-4" /> Choose file
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <Label htmlFor="cover-mode">Cover (crop to fill)</Label>
              <p className="text-xs text-muted-foreground">Off = letterbox to fit</p>
            </div>
            <Switch id="cover-mode" checked={cover} onCheckedChange={setCover} />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <Label htmlFor="bg">Background</Label>
              <p className="text-xs text-muted-foreground">Letterbox fill color</p>
            </div>
            <Input
              id="bg"
              type="color"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              className="h-9 w-16 p-1"
            />
          </div>
        </div>

        {origDims && (
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="gap-1.5">
              Original · {origName}
              <span className="text-muted-foreground">{origDims.w}×{origDims.h}</span>
            </Badge>
            <Button onClick={resize} disabled={state === "running"} className="gap-2">
              <Wand2 className="h-4 w-4" /> Resize to 1280×720
            </Button>
            <Button variant="ghost" onClick={reset} className="gap-2">
              <Trash2 className="h-4 w-4" /> Reset
            </Button>
          </div>
        )}

        {outUrl && (
          <div className="space-y-3 rounded-lg border bg-background p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Output: <span className="font-medium text-foreground">1280×720px</span>
                {" → "}YouTube thumbnail
              </p>
              <Button size="sm" onClick={download} className="gap-1.5">
                <Download className="h-4 w-4" /> Download PNG
              </Button>
            </div>
            <div className="flex justify-center rounded-md bg-muted/40 p-3">
              { }
              <img
                src={outUrl}
                alt="YouTube thumbnail output"
                className="max-h-[360px] w-full rounded-md shadow-sm"
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
