'use client'

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, Link2, Search, Download, ShieldAlert, CheckCircle2, Music, Film, Sparkles, RotateCcw,
} from "lucide-react";
import { ClientToolShell } from "@/components/tools/client-tool-shell";
import { ResultPanel, type RunState } from "@/components/tools/result-panel";
import { formatBytes } from "@/lib/tool-engine";

interface VideoFormat {
  formatId: string;
  ext: string;
  resolution: string;
  height?: number;
  fps?: number;
  vcodec: string;
  acodec: string;
  filesize?: number;
  tbr?: number;
  note?: string;
}
interface VideoInfo {
  title: string;
  uploader?: string;
  duration?: number;
  thumbnail?: string;
  webpageUrl: string;
  extractor: string;
  description?: string;
  uploadDate?: string;
  viewCount?: number;
  likeCount?: number;
  formats: VideoFormat[];
  bestByResolution: { label: string; formatId: string; ext: string; height: number }[];
}

type Step = "idle" | "fetching" | "ready" | "downloading" | "success" | "error";

const SUPPORTED_PLATFORMS = [
  "YouTube", "Instagram", "TikTok", "Facebook", "Twitter/X", "Twitch",
  "Vimeo", "Reddit", "Pinterest", "Snapchat", "LinkedIn", "SoundCloud",
  "BiliBili", "Dailymotion", "Streamable", "+ 1000 more",
];

export default function VideoDownloader() {
  const [url, setUrl] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string>();
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [selectedFormat, setSelectedFormat] = useState("best");
  const [audioOnly, setAudioOnly] = useState(false);
  const [result, setResult] = useState<{
    key: string; dir: "outputs" | "uploads"; filename: string; mime: string; size: number;
  }>();
  const [meta, setMeta] = useState<Record<string, string | number>>();

  const fetchInfo = async () => {
    if (!url.trim()) return;
    setStep("fetching");
    setError(undefined);
    setInfo(null);
    try {
      const res = await fetch("/api/video/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to fetch video info.");
      setInfo(data.info);
      setSelectedFormat("best");
      setAudioOnly(false);
      setStep("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep("error");
    }
  };

  const download = async () => {
    if (!info) return;
    const formatId = audioOnly ? "bestaudio" : selectedFormat;
    setStep("downloading");
    setError(undefined);
    try {
      const res = await fetch("/api/video/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), formatId, preferMp4: true }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Download failed.");
      setResult(data.file);
      setMeta(data.meta);
      setStep("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep("error");
    }
  };

  const reset = () => {
    setStep("idle");
    setUrl("");
    setInfo(null);
    setResult(undefined);
    setMeta(undefined);
    setError(undefined);
  };

  return (
    <ClientToolShell>
      <div className="space-y-5">
        {/* Legal disclaimer */}
        <Alert className="border-amber-500/40 bg-amber-500/5">
          <ShieldAlert className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-700 dark:text-amber-500">Use responsibly</AlertTitle>
          <AlertDescription className="text-sm text-muted-foreground">
            Only download content you own, have permission to use, or that is
            in the public domain / Creative Commons. Downloading copyrighted
            material without permission may violate platform Terms of Service
            or copyright law in your jurisdiction. You are responsible for
            your use of this tool.
          </AlertDescription>
        </Alert>

        {/* Step 1: URL input */}
        <div className="space-y-3">
          <Label htmlFor="vd-url" className="flex items-center gap-2">
            <Link2 className="h-4 w-4" /> Video URL
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="vd-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=… or Instagram/TikTok/Twitter/etc."
              className="flex-1 font-mono text-sm"
              onKeyDown={(e) => { if (e.key === "Enter" && url.trim()) fetchInfo(); }}
            />
            <Button
              onClick={fetchInfo}
              disabled={!url.trim() || step === "fetching" || step === "downloading"}
              className="gap-2"
            >
              {step === "fetching" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Fetch info
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SUPPORTED_PLATFORMS.map((p) => (
              <Badge key={p} variant="outline" className="text-[10px] font-normal">{p}</Badge>
            ))}
          </div>
        </div>

        {/* Step 2: Video preview + format picker */}
        {step === "ready" && info && (
          <div className="space-y-4 rounded-2xl border bg-card p-4">
            {/* Video header */}
            <div className="flex gap-4">
              {info.thumbnail && (
                <img
                  src={info.thumbnail}
                  alt={info.title}
                  className="h-24 w-40 shrink-0 rounded-lg object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-2 font-semibold leading-tight">{info.title}</h3>
                {info.uploader && <p className="mt-1 text-sm text-muted-foreground">by {info.uploader}</p>}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="capitalize">{info.extractor}</Badge>
                  {info.duration && (
                    <Badge variant="outline">
                      {Math.floor(info.duration / 60)}:{String(info.duration % 60).padStart(2, "0")}
                    </Badge>
                  )}
                  {info.viewCount != null && (
                    <Badge variant="outline">{info.viewCount.toLocaleString()} views</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Format picker */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  {audioOnly ? <Music className="h-4 w-4" /> : <Film className="h-4 w-4" />}
                  {audioOnly ? "Audio quality" : "Video quality"}
                </Label>
                <Button
                  size="sm"
                  variant={audioOnly ? "default" : "outline"}
                  className="pill gap-1.5"
                  onClick={() => setAudioOnly(!audioOnly)}
                >
                  <Music className="h-3.5 w-3.5" />
                  {audioOnly ? "Audio only (MP3)" : "Switch to audio only"}
                </Button>
              </div>

              {!audioOnly ? (
                <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {info.bestByResolution.map((f) => (
                      <SelectItem key={f.formatId} value={f.formatId}>
                        {f.label} · {f.ext.toUpperCase()}
                      </SelectItem>
                    ))}
                    <SelectItem value="best">Best available (auto)</SelectItem>
                    <SelectItem value="bestvideo+bestaudio">Best video + best audio (merged MP4)</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Select value={selectedFormat === "bestaudio" ? "bestaudio" : "bestaudio"} onValueChange={setSelectedFormat}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bestaudio">Best audio → MP3 (320kbps)</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-muted-foreground">
                {!audioOnly
                  ? "Higher resolutions may require merging separate video + audio streams (handled automatically via FFmpeg)."
                  : "Audio will be extracted and transcoded to high-quality MP3."}
              </p>
            </div>

            <Button onClick={download} disabled={step === "downloading"} size="lg" className="w-full gap-2">
              {step === "downloading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {step === "downloading" ? "Downloading…" : `Download ${audioOnly ? "MP3" : "video"}`}
            </Button>
          </div>
        )}

        {/* Downloading state */}
        {step === "downloading" && (
          <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-5">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div>
              <p className="font-medium">Downloading via yt-dlp…</p>
              <p className="text-sm text-muted-foreground">This can take 30s–5min depending on the video length and platform. The download runs server-side.</p>
            </div>
          </div>
        )}

        {/* Error */}
        {step === "error" && error && (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Could not download</AlertTitle>
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>
        )}

        {/* Success */}
        {step === "success" && result && (
          <div className="space-y-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <h3 className="font-semibold">Downloaded successfully</h3>
            </div>
            <div className="flex items-center gap-3 rounded-lg border bg-background p-3">
              <Film className="h-9 w-9 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{result.filename}</p>
                <p className="text-xs text-muted-foreground">{result.mime} · {formatBytes(result.size)}</p>
              </div>
              <Button asChild size="sm" className="gap-1.5">
                <a href={`/api/download?key=${encodeURIComponent(result.key)}&dir=outputs&filename=${encodeURIComponent(result.filename)}`} download={result.filename}>
                  <Download className="h-4 w-4" /> Download
                </a>
              </Button>
            </div>
            {meta && (
              <dl className="grid grid-cols-2 gap-2 border-t pt-3 text-sm sm:grid-cols-3">
                {Object.entries(meta).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{k}</dt>
                    <dd className="font-medium">{typeof v === "number" ? formatBytes(v) : String(v)}</dd>
                  </div>
                ))}
              </dl>
            )}
            <Button variant="outline" size="sm" onClick={reset} className="gap-1.5">
              <RotateCcw className="h-4 w-4" /> Download another
            </Button>
          </div>
        )}

        {/* Idle hint */}
        {step === "idle" && (
          <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            <Sparkles className="mx-auto mb-2 h-6 w-6" />
            Paste a video URL above and click <strong>Fetch info</strong> to see
            available qualities. Works with 1000+ sites including YouTube,
            Instagram, TikTok, Twitter/X, Facebook, Twitch, Vimeo, Reddit and more.
          </div>
        )}
      </div>
    </ClientToolShell>
  );
}
