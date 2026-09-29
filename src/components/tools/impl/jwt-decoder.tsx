'use client'

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { KeyRound, Trash2, Copy, Check, AlertTriangle } from "lucide-react";
import { ClientToolShell } from "@/components/tools/client-tool-shell";
import { ResultPanel, type RunState } from "@/components/tools/result-panel";

function base64UrlDecode(part: string): string {
  // Convert base64url -> base64 and pad
  let b64 = part.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

interface DecodedJwt {
  header: unknown;
  payload: unknown;
  signature: string;
}

function decodeJwt(token: string): DecodedJwt {
  const parts = token.trim().split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT: expected 3 dot-separated parts (header.payload.signature).");
  }
  const header = JSON.parse(base64UrlDecode(parts[0]));
  const payload = JSON.parse(base64UrlDecode(parts[1]));
  return { header, payload, signature: parts[2] };
}

export default function JwtDecoder() {
  const [input, setInput] = useState("");
  const [state, setState] = useState<RunState>("idle");
  const [error, setError] = useState<string>();
  const [decoded, setDecoded] = useState<DecodedJwt | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const run = () => {
    setState("running");
    setError(undefined);
    setDecoded(null);
    try {
      const trimmed = input.trim();
      if (!trimmed) throw new Error("Paste a JWT to decode.");
      setDecoded(decodeJwt(trimmed));
      setState("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  };

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(key);
      setTimeout(() => setCopiedField(null), 1500);
    } catch { /* ignore */ }
  };

  const headerStr = decoded ? JSON.stringify(decoded.header, null, 2) : "";
  const payloadStr = decoded ? JSON.stringify(decoded.payload, null, 2) : "";

  // Best-effort expiry inspection
  const exp = decoded?.payload && typeof decoded.payload === "object"
    ? (decoded.payload as Record<string, unknown>).exp
    : undefined;
  let expNote: string | null = null;
  if (typeof exp === "number") {
    const date = new Date(exp * 1000);
    const isPast = date.getTime() < Date.now();
    expNote = `${date.toISOString()} (${isPast ? "expired" : "valid"})`;
  }

  return (
    <ClientToolShell>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="jwt-in">JWT token</Label>
          <Textarea
            id="jwt-in"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6Ik5leFRvb2wiLCJpYXQiOjE1MTYyMzkwMjJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
            className="min-h-[110px] font-mono text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={run} disabled={!input.trim() || state === "running"} className="gap-2">
            <KeyRound className="h-4 w-4" /> Decode
          </Button>
          <Button variant="ghost" onClick={() => { setInput(""); setDecoded(null); setState("idle"); }} className="gap-2">
            <Trash2 className="h-4 w-4" /> Clear
          </Button>
          <p className="ml-auto text-xs text-muted-foreground">
            Decoding only — signature is <strong>not</strong> verified.
          </p>
        </div>

        {state === "success" && decoded && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Header</h3>
                  <Button size="sm" variant="outline" onClick={() => copy("header", headerStr)} className="gap-1.5">
                    {copiedField === "header" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copiedField === "header" ? "Copied" : "Copy"}
                  </Button>
                </div>
                <pre className="max-h-72 overflow-auto rounded-lg bg-muted p-3 text-xs font-mono">{headerStr}</pre>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Payload</h3>
                  <Button size="sm" variant="outline" onClick={() => copy("payload", payloadStr)} className="gap-1.5">
                    {copiedField === "payload" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copiedField === "payload" ? "Copied" : "Copy"}
                  </Button>
                </div>
                <pre className="max-h-72 overflow-auto rounded-lg bg-muted p-3 text-xs font-mono">{payloadStr}</pre>
              </div>
            </div>

            {expNote && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>
                  <code className="font-mono">exp</code> claim: {expNote}
                </span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Signature (base64url, not verified)</Label>
              <pre className="overflow-auto rounded-lg bg-muted p-3 text-xs font-mono break-all whitespace-pre-wrap">{decoded.signature}</pre>
            </div>
          </div>
        )}

        <ResultPanel state={state} error={error} onReset={() => setState("idle")} />
      </div>
    </ClientToolShell>
  );
}
