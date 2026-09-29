'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Download, QrCode, Link2, FileText, Mail, Phone, MessageSquare,
  Wifi, Contact, Image as ImageIcon, FileCode,
} from "lucide-react";
import { ClientToolShell } from "@/components/tools/client-tool-shell";
import { ResultPanel, type RunState } from "@/components/tools/result-panel";

type QRType = "url" | "text" | "email" | "phone" | "sms" | "wifi" | "vcard";

type ErrLevel = "L" | "M" | "Q" | "H";

const TYPE_META: Record<QRType, { label: string; icon: typeof Link2 }> = {
  url: { label: "URL", icon: Link2 },
  text: { label: "Text", icon: FileText },
  email: { label: "Email", icon: Mail },
  phone: { label: "Phone", icon: Phone },
  sms: { label: "SMS", icon: MessageSquare },
  wifi: { label: "WiFi", icon: Wifi },
  vcard: { label: "vCard", icon: Contact },
};

function hexToRgba(hex: string, fallback: string): string {
  const m = /^#?([a-fA-F0-9]{6})$/.exec(hex.trim());
  if (!m) return fallback;
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}ff`;
}

export default function QrGenerator() {
  const [type, setType] = useState<QRType>("url");
  // generic fields
  const [url, setUrl] = useState("https://example.com");
  const [text, setText] = useState("");
  const [email, setEmail] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [phone, setPhone] = useState("");
  const [smsPhone, setSmsPhone] = useState("");
  const [smsBody, setSmsBody] = useState("");
  const [wifiSsid, setWifiSsid] = useState("");
  const [wifiPass, setWifiPass] = useState("");
  const [wifiEnc, setWifiEnc] = useState<"WPA" | "WEP" | "nopass">("WPA");
  const [wifiHidden, setWifiHidden] = useState(false);
  const [vName, setVName] = useState("");
  const [vPhone, setVPhone] = useState("");
  const [vEmail, setVEmail] = useState("");
  const [vOrg, setVOrg] = useState("");

  // options
  const [size, setSize] = useState(512);
  const [ecc, setEcc] = useState<ErrLevel>("M");
  const [fg, setFg] = useState("#000000");
  const [bg, setBg] = useState("#FFFFFF");

  const [pngUrl, setPngUrl] = useState<string | null>(null);
  const [svgString, setSvgString] = useState<string | null>(null);
  const [state, setState] = useState<RunState>("idle");
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const renderToken = useRef(0);

  const payload = useMemo(() => buildPayload(type, {
    url, text, email, emailSubject, emailBody, phone,
    smsPhone, smsBody, wifiSsid, wifiPass, wifiEnc, wifiHidden,
    vName, vPhone, vEmail, vOrg,
  }), [
    type, url, text, email, emailSubject, emailBody, phone,
    smsPhone, smsBody, wifiSsid, wifiPass, wifiEnc, wifiHidden,
    vName, vPhone, vEmail, vOrg,
  ]);

  // Live preview as inputs change — debounced via rAF-ish effect.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!payload) {
      setPngUrl(null);
      setSvgString(null);
      setState("idle");
      return;
    }
    const myToken = ++renderToken.current;
    setState("running");
    setError(undefined);
    QRCode.toDataURL(payload, {
      errorCorrectionLevel: ecc,
      width: size,
      margin: 2,
      color: { dark: hexToRgba(fg, "#000000ff"), light: hexToRgba(bg, "#ffffffff") },
    })
      .then((dataUrl) => {
        if (renderToken.current !== myToken) return;
        setPngUrl(dataUrl);
        return QRCode.toString(payload, {
          type: "svg",
          errorCorrectionLevel: ecc,
          width: size,
          margin: 2,
          color: { dark: hexToRgba(fg, "#000000ff"), light: hexToRgba(bg, "#ffffffff") },
        });
      })
      .then((svg) => {
        if (renderToken.current !== myToken) return;
        if (svg) setSvgString(svg);
        setState("success");
      })
      .catch((e) => {
        if (renderToken.current !== myToken) return;
        setError(e instanceof Error ? e.message : String(e));
        setState("error");
      });
  }, [payload, ecc, size, fg, bg]);

  const downloadPng = () => {
    if (!pngUrl) return;
    const a = document.createElement("a");
    a.href = pngUrl;
    a.download = `qr-${type}-${size}.png`;
    a.click();
  };

  const downloadSvg = () => {
    if (!svgString) return;
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-${type}-${size}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyPayload = async () => {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <ClientToolShell>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <QrCode className="h-5 w-5 text-primary" />
          </span>
          <div>
            <h2 className="text-base font-semibold">QR Code Generator</h2>
            <p className="text-sm text-muted-foreground">Generate scannable QR codes — 100% in your browser.</p>
          </div>
        </div>

        <Tabs value={type} onValueChange={(v) => setType(v as QRType)}>
          <div className="overflow-x-auto pb-1">
            <TabsList>
              {(Object.keys(TYPE_META) as QRType[]).map((k) => {
                const Icon = TYPE_META[k].icon;
                return (
                  <TabsTrigger key={k} value={k} className="gap-1.5">
                    <Icon className="h-3.5 w-3.5" /> {TYPE_META[k].label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
        </Tabs>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Inputs */}
          <div className="space-y-3">
            {type === "url" && (
              <Field label="URL">
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
              </Field>
            )}
            {type === "text" && (
              <Field label="Text">
                <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Any text content…" className="min-h-[120px]" />
              </Field>
            )}
            {type === "email" && (
              <>
                <Field label="Recipient email">
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hello@example.com" />
                </Field>
                <Field label="Subject (optional)">
                  <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="Hello" />
                </Field>
                <Field label="Body (optional)">
                  <Textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} placeholder="Message body…" className="min-h-[80px]" />
                </Field>
              </>
            )}
            {type === "phone" && (
              <Field label="Phone number">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 000 1234" />
              </Field>
            )}
            {type === "sms" && (
              <>
                <Field label="Phone number">
                  <Input value={smsPhone} onChange={(e) => setSmsPhone(e.target.value)} placeholder="+15550001234" />
                </Field>
                <Field label="Message">
                  <Textarea value={smsBody} onChange={(e) => setSmsBody(e.target.value)} placeholder="Hi there" className="min-h-[80px]" />
                </Field>
              </>
            )}
            {type === "wifi" && (
              <>
                <Field label="Network name (SSID)">
                  <Input value={wifiSsid} onChange={(e) => setWifiSsid(e.target.value)} placeholder="MyNetwork" />
                </Field>
                <Field label="Password">
                  <Input value={wifiPass} onChange={(e) => setWifiPass(e.target.value)} placeholder="••••••••" />
                </Field>
                <Field label="Encryption">
                  <Select value={wifiEnc} onValueChange={(v) => setWifiEnc(v as typeof wifiEnc)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WPA">WPA / WPA2</SelectItem>
                      <SelectItem value="WEP">WEP</SelectItem>
                      <SelectItem value="nopass">None (open)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <Label htmlFor="wifi-hidden" className="cursor-pointer text-sm">Hidden network</Label>
                  <Switch id="wifi-hidden" checked={wifiHidden} onCheckedChange={setWifiHidden} />
                </div>
              </>
            )}
            {type === "vcard" && (
              <>
                <Field label="Full name">
                  <Input value={vName} onChange={(e) => setVName(e.target.value)} placeholder="Jane Doe" />
                </Field>
                <Field label="Phone">
                  <Input value={vPhone} onChange={(e) => setVPhone(e.target.value)} placeholder="+1 555 000 1234" />
                </Field>
                <Field label="Email">
                  <Input type="email" value={vEmail} onChange={(e) => setVEmail(e.target.value)} placeholder="jane@example.com" />
                </Field>
                <Field label="Organization">
                  <Input value={vOrg} onChange={(e) => setVOrg(e.target.value)} placeholder="Acme Inc." />
                </Field>
              </>
            )}

            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Encoded payload</p>
              <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all rounded bg-background p-2 text-xs font-mono">
                {payload || "—"}
              </pre>
              <div className="mt-2 flex items-center justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={copyPayload} className="gap-1.5" disabled={!payload}>
                  {copied ? "Copied" : "Copy payload"}
                </Button>
              </div>
            </div>
          </div>

          {/* Options + preview */}
          <div className="space-y-3">
            <div className="rounded-lg border p-4">
              <div className="mb-3 flex items-center justify-between">
                <Label>Size</Label>
                <Badge variant="secondary">{size}px</Badge>
              </div>
              <Slider
                min={128}
                max={1024}
                step={32}
                value={[size]}
                onValueChange={(v) => setSize(v[0])}
              />
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>128</span><span>1024</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Error correction">
                <Select value={ecc} onValueChange={(v) => setEcc(v as ErrLevel)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">L · 7%</SelectItem>
                    <SelectItem value="M">M · 15%</SelectItem>
                    <SelectItem value="Q">Q · 25%</SelectItem>
                    <SelectItem value="H">H · 30%</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Foreground">
                  <Input type="color" value={fg} onChange={(e) => setFg(e.target.value)} className="h-9 p-1" />
                </Field>
                <Field label="Background">
                  <Input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="h-9 p-1" />
                </Field>
              </div>
            </div>

            <div className="rounded-lg border bg-background p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium">Preview</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={downloadSvg} disabled={!svgString} className="gap-1.5">
                    <FileCode className="h-4 w-4" /> SVG
                  </Button>
                  <Button size="sm" onClick={downloadPng} disabled={!pngUrl} className="gap-1.5">
                    <Download className="h-4 w-4" /> PNG
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-center rounded-md bg-muted/40 p-4">
                {pngUrl ? (
                   
                  <img
                    src={pngUrl}
                    alt="Generated QR code"
                    className="max-h-[320px] w-auto rounded-md shadow-sm"
                    style={{ background: bg }}
                  />
                ) : (
                  <div className="flex h-[320px] w-[320px] items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                )}
              </div>
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

type PayloadArgs = {
  url: string; text: string; email: string; emailSubject: string; emailBody: string;
  phone: string; smsPhone: string; smsBody: string;
  wifiSsid: string; wifiPass: string; wifiEnc: "WPA" | "WEP" | "nopass"; wifiHidden: boolean;
  vName: string; vPhone: string; vEmail: string; vOrg: string;
};

function escapeWifi(s: string): string {
  // Escape special characters per WiFi QR spec
  return s.replace(/([\\;,:"])/g, "\\$1");
}

function buildPayload(type: QRType, a: PayloadArgs): string {
  switch (type) {
    case "url": {
      const u = a.url.trim();
      if (!u) return "";
      // Default to https:// if no scheme
      return /^https?:\/\//i.test(u) || /^[\w]+:/i.test(u) ? u : `https://${u}`;
    }
    case "text":
      return a.text;
    case "email": {
      const e = a.email.trim();
      if (!e) return "";
      const params = new URLSearchParams();
      if (a.emailSubject.trim()) params.set("subject", a.emailSubject);
      if (a.emailBody.trim()) params.set("body", a.emailBody);
      const qs = params.toString();
      return `mailto:${e}${qs ? `?${qs}` : ""}`;
    }
    case "phone":
      return a.phone.trim() ? `tel:${a.phone.replace(/\s+/g, "")}` : "";
    case "sms": {
      const p = a.smsPhone.trim();
      if (!p) return "";
      const body = a.smsBody.trim();
      return body ? `SMSTO:${p}:${body}` : `SMSTO:${p}:`;
    }
    case "wifi": {
      const ssid = a.wifiSsid.trim();
      if (!ssid) return "";
      const t = a.wifiEnc;
      const p = a.wifiEnc === "nopass" ? "" : escapeWifi(a.wifiPass);
      const hidden = a.wifiHidden ? "H:true;" : "";
      return `WIFI:T:${t};S:${escapeWifi(ssid)};P:${p};${hidden};`;
    }
    case "vcard": {
      const name = a.vName.trim();
      if (!name && !a.vPhone.trim() && !a.vEmail.trim()) return "";
      const lines = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `N:${name}`,
        a.vOrg.trim() ? `ORG:${a.vOrg.trim()}` : "",
        a.vPhone.trim() ? `TEL:${a.vPhone.trim()}` : "",
        a.vEmail.trim() ? `EMAIL:${a.vEmail.trim()}` : "",
        "END:VCARD",
      ].filter(Boolean);
      return lines.join("\n");
    }
  }
}
