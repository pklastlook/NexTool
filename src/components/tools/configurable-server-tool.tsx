'use client'

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { FileDropzone } from "@/components/tools/file-dropzone";
import { ResultPanel, type RunState } from "@/components/tools/result-panel";
import { type ToolDef } from "@/lib/tool-registry";
import { formatBytes } from "@/lib/tool-engine";
import { Loader2, Wand2 } from "lucide-react";

/**
 * Server tool with per-tool option controls.
 * Generates the right options UI based on the slug, collects them as form
 * fields, and posts to /api/process/[slug].
 */
export function ConfigurableServerTool({ tool }: { tool: ToolDef }) {
  const slug = tool.slug;
  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<RunState>("idle");
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<{
    text?: string; textFilename?: string;
    file?: { key: string; dir: "outputs" | "uploads"; filename: string; mime: string; size: number };
    meta?: Record<string, string | number>;
  }>({});

  // Option state (defaults per tool)
  const [format, setFormat] = useState(defaultFormat(slug));
  const [quality, setQuality] = useState(slug.includes("compress") ? 60 : 82);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [percent, setPercent] = useState("50");
  const [from, setFrom] = useState("1");
  const [to, setTo] = useState("1");
  const [angle, setAngle] = useState("90");
  const [level, setLevel] = useState("medium");
  const [crf, setCrf] = useState(28);
  const [scale, setScale] = useState(720);
  const [fps, setFps] = useState(10);
  const [lang, setLang] = useState("eng");

  const accept = useMemo(() => {
    return (tool.inputFormats ?? []).map((m) => "." + m.split("/").pop()).join(",") || "*";
  }, [tool.inputFormats]);

  const run = async () => {
    if (files.length === 0) return;
    setState("running"); setError(undefined);
    try {
      const fd = new FormData();
      files.forEach((f, i) => fd.append(`file${i}`, f));
      // Collect options
      if (slug === "image-converter") { fd.append("format", format); fd.append("quality", String(quality)); }
      if (slug === "image-compressor") { fd.append("quality", String(quality)); }
      if (slug === "image-resizer") {
        if (width) fd.append("width", width);
        if (height) fd.append("height", height);
        if (!width && !height) fd.append("percent", percent);
      }
      if (slug === "image-cropper") { fd.append("left", "0"); fd.append("top", "0"); fd.append("width", width || "100"); fd.append("height", height || "100"); }
      if (slug === "split-pdf") { fd.append("from", from); fd.append("to", to); }
      if (slug === "rotate-pdf") { fd.append("angle", angle); }
      if (slug === "compress-pdf") { fd.append("level", level); }
      if (slug === "image-to-text") { fd.append("lang", lang); }
      if (slug === "video-converter") { fd.append("format", format); }
      if (slug === "video-compressor") { fd.append("crf", String(crf)); fd.append("scale", String(scale)); }
      if (slug === "video-to-gif") { fd.append("fps", String(fps)); fd.append("width", "480"); }
      if (slug === "audio-converter") { fd.append("format", format); }

      const res = await fetch(`/api/process/${slug}`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || `Processing failed (HTTP ${res.status}).`);
      setResult(data); setState("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  };

  const reset = () => { setState("idle"); setFiles([]); setResult({}); };

  return (
    <div className="space-y-5">
      <FileDropzone
        accept={accept}
        maxSize={tool.maxFileSize ?? 10485760}
        multiple={slug === "merge-pdf"}
        onFiles={setFiles}
        selected={files}
        onRemove={(i) => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
      />

      {/* Per-tool options */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {slug === "image-converter" && (
          <>
            <Field label="Output format">
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="jpeg">JPG</SelectItem>
                  <SelectItem value="png">PNG</SelectItem>
                  <SelectItem value="webp">WebP</SelectItem>
                  <SelectItem value="avif">AVIF</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={`Quality: ${quality}`}>
              <Slider value={[quality]} min={10} max={100} step={1} onValueChange={(v) => setQuality(v[0])} />
            </Field>
          </>
        )}

        {slug === "image-compressor" && (
          <Field label={`Quality: ${quality} (lower = smaller file)`}>
            <Slider value={[quality]} min={10} max={95} step={1} onValueChange={(v) => setQuality(v[0])} />
          </Field>
        )}

        {slug === "image-resizer" && (
          <>
            <Field label="Width (px) — leave blank for %"><Input type="number" value={width} onChange={(e) => setWidth(e.target.value)} placeholder="e.g. 800" /></Field>
            <Field label="Height (px) — optional"><Input type="number" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="e.g. 600" /></Field>
            {!width && !height && (
              <Field label={`Percent: ${percent}%`}>
                <Slider value={[Number(percent)]} min={10} max={200} step={5} onValueChange={(v) => setPercent(String(v[0]))} />
              </Field>
            )}
          </>
        )}

        {slug === "image-cropper" && (
          <>
            <Field label="Crop width (px)"><Input type="number" value={width} onChange={(e) => setWidth(e.target.value)} /></Field>
            <Field label="Crop height (px)"><Input type="number" value={height} onChange={(e) => setHeight(e.target.value)} /></Field>
          </>
        )}

        {slug === "split-pdf" && (
          <>
            <Field label="From page"><Input type="number" min="1" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="To page"><Input type="number" min="1" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          </>
        )}

        {slug === "rotate-pdf" && (
          <Field label="Rotation angle">
            <Select value={angle} onValueChange={setAngle}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="90">90° clockwise</SelectItem>
                <SelectItem value="180">180°</SelectItem>
                <SelectItem value="270">270° clockwise</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}

        {slug === "compress-pdf" && (
          <Field label="Compression level">
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low (better quality)</SelectItem>
                <SelectItem value="medium">Medium (balanced)</SelectItem>
                <SelectItem value="high">High (smallest file)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}

        {slug === "image-to-text" && (
          <Field label="OCR language">
            <Select value={lang} onValueChange={setLang}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="eng">English</SelectItem>
                <SelectItem value="urd">Urdu</SelectItem>
                <SelectItem value="ara">Arabic</SelectItem>
                <SelectItem value="fra">French</SelectItem>
                <SelectItem value="deu">German</SelectItem>
                <SelectItem value="spa">Spanish</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}

        {slug === "video-converter" && (
          <Field label="Output format">
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mp4">MP4 (H.264)</SelectItem>
                <SelectItem value="webm">WebM (VP9)</SelectItem>
                <SelectItem value="mov">MOV</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}

        {slug === "video-compressor" && (
          <>
            <Field label={`Quality (CRF ${crf} — higher = smaller)`}>
              <Slider value={[crf]} min={18} max={40} step={1} onValueChange={(v) => setCrf(v[0])} />
            </Field>
            <Field label={`Max height: ${scale}px`}>
              <Slider value={[scale]} min={240} max={1080} step={120} onValueChange={(v) => setScale(v[0])} />
            </Field>
          </>
        )}

        {slug === "video-to-gif" && (
          <Field label={`Frames per second: ${fps}`}>
            <Slider value={[fps]} min={5} max={24} step={1} onValueChange={(v) => setFps(v[0])} />
          </Field>
        )}

        {slug === "audio-converter" && (
          <Field label="Output format">
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mp3">MP3</SelectItem>
                <SelectItem value="wav">WAV</SelectItem>
                <SelectItem value="aac">AAC</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}
      </div>

      <Button onClick={run} disabled={files.length === 0 || state === "running"} size="lg" className="gap-2">
        {state === "running" ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</> : <><Wand2 className="h-4 w-4" /> Run tool</>}
      </Button>

      <ResultPanel
        state={state} error={error}
        text={result.text} textFilename={result.textFilename}
        file={result.file} meta={result.meta} onReset={reset}
      />
    </div>
  );
}

function defaultFormat(slug: string): string {
  if (slug.includes("video")) return "mp4";
  if (slug.includes("audio")) return "mp3";
  return "webp";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
