'use client'

import { useCallback, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

type UploadResult = {
  ok: boolean;
  filename?: string;
  path?: string;
  size?: number;
  preview?: string;
  error?: string;
};

export default function Home() {
  const { toast } = useToast();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [pastedName, setPastedName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setUploading(true);
      setResult(null);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data: UploadResult = await res.json();
        setResult(data);

        if (data.ok) {
          toast({
            title: "Uploaded",
            description: `Saved as ${data.filename} (${data.size} bytes).`,
          });
        } else {
          toast({
            variant: "destructive",
            title: "Upload failed",
            description: data.error || "Unknown error",
          });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setResult({ ok: false, error: msg });
        toast({ variant: "destructive", title: "Upload failed", description: msg });
      } finally {
        setUploading(false);
      }
    },
    [toast]
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = "";
    },
    [handleFile]
  );

  const submitText = useCallback(async () => {
    if (!pastedText.trim()) {
      toast({ variant: "destructive", title: "Empty", description: "Paste some text first." });
      return;
    }
    setUploading(true);
    setResult(null);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pastedText, filename: pastedName || undefined }),
      });
      const data: UploadResult = await res.json();
      setResult(data);
      if (data.ok) {
        toast({
          title: "Saved",
          description: `Saved as ${data.filename} (${data.size} bytes).`,
        });
      } else {
        toast({ variant: "destructive", title: "Save failed", description: data.error });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setResult({ ok: false, error: msg });
      toast({ variant: "destructive", title: "Save failed", description: msg });
    } finally {
      setUploading(false);
    }
  }, [pastedText, pastedName, toast]);

  const sizeLabel = (n?: number) => {
    if (typeof n !== "number") return "";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-10 sm:py-16">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mb-4">
            <Upload className="w-7 h-7" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Send me your prompt
          </h1>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            The IM file attachment pipeline is currently broken, so files sent
            through the chat uploader never reach the server. Use this page
            instead — uploads are written to{" "}
            <code className="px-1.5 py-0.5 rounded bg-muted text-foreground text-sm">
              /home/z/my-project/upload/
            </code>{" "}
            where I can read them directly.
          </p>
        </div>

        <Tabs defaultValue="file" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="file">
              <FileText className="w-4 h-4 mr-2" /> Upload file
            </TabsTrigger>
            <TabsTrigger value="paste">
              <FileText className="w-4 h-4 mr-2" /> Paste text
            </TabsTrigger>
          </TabsList>

          {/* ---- File upload tab ---- */}
          <TabsContent value="file">
            <Card>
              <CardHeader>
                <CardTitle>Upload a file</CardTitle>
                <CardDescription>
                  Drag &amp; drop or browse. Supports <code>.txt</code>,{" "}
                  <code>.md</code>, <code>.docx</code>, <code>.pdf</code>, or
                  any text-like file.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  onClick={() => inputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
                  }}
                  className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors ${
                    dragging
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/30 hover:border-primary/60 hover:bg-muted/40"
                  }`}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    className="sr-only"
                    onChange={onPick}
                  />
                  {uploading ? (
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  ) : (
                    <Upload className="w-8 h-8 text-muted-foreground" />
                  )}
                  <div className="text-center">
                    <p className="font-medium">
                      {dragging ? "Drop to upload" : "Click to browse or drop a file"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Any file size up to ~10 MB
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---- Paste text tab ---- */}
          <TabsContent value="paste">
            <Card>
              <CardHeader>
                <CardTitle>Paste text directly</CardTitle>
                <CardDescription>
                  Most reliable option — copy your prompt and paste it here.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="filename">Filename (optional)</Label>
                  <input
                    id="filename"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="my-prompt"
                    value={pastedName}
                    onChange={(e) => setPastedName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prompt-text">Prompt content</Label>
                  <Textarea
                    id="prompt-text"
                    placeholder="Paste your full prompt here…"
                    className="min-h-[300px] font-mono text-sm"
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {pastedText.length.toLocaleString()} characters
                  </p>
                </div>
                <Button
                  onClick={submitText}
                  disabled={uploading || !pastedText.trim()}
                  className="w-full"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Save text to upload folder
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ---- Result panel ---- */}
        {result && (
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                {result.ok ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                )}
                <CardTitle className="text-lg">
                  {result.ok ? "Saved successfully" : "Upload failed"}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {result.ok ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{result.filename}</Badge>
                    <Badge variant="outline">{sizeLabel(result.size)}</Badge>
                  </div>
                  <div className="rounded-md bg-muted p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      Saved to
                    </p>
                    <code className="text-xs break-all">{result.path}</code>
                  </div>
                  {result.preview && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                        Preview (first 500 chars)
                      </p>
                      <pre className="whitespace-pre-wrap break-words text-xs rounded-md bg-muted p-3 max-h-60 overflow-y-auto">
                        {result.preview}
                      </pre>
                    </div>
                  )}
                  <Alert>
                    <CheckCircle2 className="w-4 h-4" />
                    <AlertTitle>All set</AlertTitle>
                    <AlertDescription>
                      I can now read this file. Go back to the chat and tell me
                      to start — I&apos;ll read it and begin planning.
                    </AlertDescription>
                  </Alert>
                </>
              ) : (
                <Alert variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{result.error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      <footer className="mt-auto border-t bg-background/60 backdrop-blur py-4">
        <div className="max-w-3xl mx-auto px-4 text-center text-xs text-muted-foreground">
          Files are written to <code>/home/z/my-project/upload/</code> on the
          server and are readable by the assistant immediately.
        </div>
      </footer>
    </div>
  );
}
