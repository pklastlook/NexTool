'use client';

import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Barcode, Download, Trash2 } from "lucide-react";
import { ClientToolShell } from "@/components/tools/client-tool-shell";
import { ResultPanel, type RunState } from "@/components/tools/result-panel";

type FormatKey =
  | "CODE128" | "CODE39" | "EAN13" | "EAN8"
  | "UPC" | "ITF14" | "MSI" | "pharmacode";

const FORMATS: { value: FormatKey; label: string; hint: string }[] = [
  { value: "CODE128", label: "CODE128", hint: "Any ASCII text" },
  { value: "CODE39", label: "CODE39", hint: "A-Z 0-9 . - $ / + % space" },
  { value: "EAN13", label: "EAN-13", hint: "12 or 13 digits" },
  { value: "EAN8", label: "EAN-8", hint: "7 or 8 digits" },
  { value: "UPC", label: "UPC-A", hint: "11 or 12 digits" },
  { value: "ITF14", label: "ITF-14", hint: "13 or 14 digits" },
  { value: "MSI", label: "MSI", hint: "Digits only" },
  { value: "pharmacode", label: "Pharmacode", hint: "Integer 3–131070" },
];

function validateInput(format: FormatKey, data: string): string | null {
  const v = data.trim();
  if (!v) return "Enter data first.";
  switch (format) {
    case "CODE128":
      if (v.length > 80) return "CODE128 input is too long (max 80 chars).";
      return null;
    case "CODE39": {
      if (!/^[A-Z0-9 \-.+$/%]+$/.test(v)) return "CODE39 allows only A-Z, 0-9, space and . - $ / + %";
      return null;
    }
    case "EAN13": {
      if (!/^\d{12,13}$/.test(v)) return "EAN-13 needs exactly 12 or 13 digits.";
      return null;
    }
    case "EAN8": {
      if (!/^\d{7,8}$/.test(v)) return "EAN-8 needs exactly 7 or 8 digits.";
      return null;
    }
    case "UPC": {
      if (!/^\d{11,12}$/.test(v)) return "UPC-A needs exactly 11 or 12 digits.";
      return null;
    }
    case "ITF14": {
      if (!/^\d{13,14}$/.test(v)) return "ITF-14 needs exactly 13 or 14 digits.";
      return null;
    }
    case "MSI": {
      if (!/^\d+$/.test(v)) return "MSI allows digits only.";
      return null;
    }
    case "pharmacode": {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 3 || n > 131070) return "Pharmacode must be an integer 3–131070.";
      return null;
    }
  }
}

export default function BarcodeGenerator() {
  const [format, setFormat] = useState<FormatKey>("CODE128");
  const [data, setData] = useState("123456789012");
  const [barWidth, setBarWidth] = useState(2);
  const [height, setHeight] = useState(100);
  const [displayValue, setDisplayValue] = useState(true);
  const [margin, setMargin] = useState(10);
  const [bg, setBg] = useState("#FFFFFF");
  const [lineColor, setLineColor] = useState("#000000");
  const [state, setState] = useState<RunState>("idle");
  const [error, setError] = useState<string>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderToken = useRef(0);

  // Live redraw on any change.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const myToken = ++renderToken.current;
    const validationError = validateInput(format, data);
    if (validationError) {
      setError(validationError);
      setState("error");
      return;
    }
    setState("running");
    setError(undefined);
    // Defer to next frame so canvas is mounted before draw.
    const id = requestAnimationFrame(() => {
      if (renderToken.current !== myToken) return;
      try {
        const canvas = canvasRef.current;
        if (!canvas) {
          setError("Canvas not ready. Try again.");
          setState("error");
          return;
        }
        // Clear previous
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        JsBarcode(canvas, data.trim(), {
          format,
          width: barWidth,
          height,
          displayValue,
          margin,
          background: bg,
          lineColor,
          font: "monospace",
          fontSize: 16,
          textMargin: 2,
        });
        setState("success");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setState("error");
      }
    });
    return () => cancelAnimationFrame(id);
  }, [format, data, barWidth, height, displayValue, margin, bg, lineColor]);

  const downloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `barcode-${format.toLowerCase()}-${data.trim().slice(0, 16) || "out"}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  const reset = () => {
    setFormat("CODE128");
    setData("123456789012");
    setBarWidth(2);
    setHeight(100);
    setDisplayValue(true);
    setMargin(10);
    setBg("#FFFFFF");
    setLineColor("#000000");
    setState("idle");
    setError(undefined);
  };

  const currentFormat = FORMATS.find((f) => f.value === format)!;

  return (
    <ClientToolShell>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Barcode className="h-5 w-5 text-primary" />
          </span>
          <div>
            <h2 className="text-base font-semibold">Barcode Generator</h2>
            <p className="text-sm text-muted-foreground">Renders scannable barcodes locally — no uploads.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as FormatKey)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMATS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{f.label}</span>
                        <span className="text-xs text-muted-foreground">· {f.hint}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bc-data">Data</Label>
              <Input
                id="bc-data"
                value={data}
                onChange={(e) => setData(e.target.value)}
                placeholder={currentFormat.hint}
              />
              <p className="text-xs text-muted-foreground">{currentFormat.hint}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={`Bar width: ${barWidth}px`}>
                <Slider min={1} max={6} step={1} value={[barWidth]} onValueChange={(v) => setBarWidth(v[0])} />
              </Field>
              <Field label={`Height: ${height}px`}>
                <Slider min={40} max={240} step={10} value={[height]} onValueChange={(v) => setHeight(v[0])} />
              </Field>
              <Field label={`Margin: ${margin}px`}>
                <Slider min={0} max={40} step={2} value={[margin]} onValueChange={(v) => setMargin(v[0])} />
              </Field>
              <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <Label htmlFor="bc-display" className="cursor-pointer text-sm">Show value</Label>
                <Switch id="bc-display" checked={displayValue} onCheckedChange={setDisplayValue} />
              </div>
              <Field label="Bars">
                <Input type="color" value={lineColor} onChange={(e) => setLineColor(e.target.value)} className="h-9 p-1" />
              </Field>
              <Field label="Background">
                <Input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="h-9 p-1" />
              </Field>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button variant="ghost" onClick={reset} className="gap-2">
                <Trash2 className="h-4 w-4" /> Reset
              </Button>
              <p className="text-xs text-muted-foreground">Preview updates live as you change inputs.</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-lg border bg-background p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">Preview</p>
                  <Badge variant="secondary">{format}</Badge>
                </div>
                <Button size="sm" onClick={downloadPng} disabled={state !== "success"} className="gap-1.5">
                  <Download className="h-4 w-4" /> PNG
                </Button>
              </div>
              <div className="flex items-center justify-center overflow-x-auto rounded-md bg-muted/40 p-4">
                <canvas
                  ref={canvasRef}
                  className="max-w-full rounded-sm"
                  style={{ background: bg }}
                />
              </div>
              {data.trim() && (
                <p className="mt-2 break-all text-xs text-muted-foreground">
                  Encoding: <span className="font-mono">{data.trim()}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        <ResultPanel state={state} error={error} onReset={() => setState("idle")} />
      </div>
    </ClientToolShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
