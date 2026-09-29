'use client'

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ArrowRight, Clock, RefreshCw } from "lucide-react";
import { ClientToolShell } from "@/components/tools/client-tool-shell";

const ZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
];

const dtf = (zone: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  });

function localNowForZone(zone: string): Date {
  // Compute "now" interpreted in the target zone by using formatToParts.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  // Build a UTC Date from the wall-clock parts of the target zone.
  const iso = `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}Z`;
  return new Date(iso);
}

function localOffset(zone: string): string {
  // Compute offset in minutes using the IANA tz database via Intl, then format.
  const dt = new Date();
  const offsetMin = zoneOffsetMinutes(zone, dt);
  if (offsetMin === 0) return "UTC";
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${String(h).padStart(2, "0")}${m ? ":" + String(m).padStart(2, "0") : ""}`;
}

export default function TimeZoneConverter() {
  // Local datetime-local string in source zone
  const [sourceZone, setSourceZone] = useState<string>("UTC");
  const [targetZone, setTargetZone] = useState<string>("Asia/Karachi");
  // initial value = "now" in source zone (wall-clock), set lazily once on first render
  const [localInput, setLocalInput] = useState<string>(() => {
    const d = localNowForZone("UTC");
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  });
  const [now, setNow] = useState<Date>(new Date());

  const converted = useMemo(() => {
    if (!localInput) return null;
    // localInput is wall-clock time in sourceZone.
    // Strategy: construct Date by interpreting localInput as if in sourceZone.
    // Use Intl to convert to target zone.
    const parsed = new Date(localInput);
    if (isNaN(parsed.getTime())) return null;

    // Get offset of source zone at this moment so we can convert wall-clock -> epoch ms.
    const sourceOffsetMin = zoneOffsetMinutes(sourceZone, parsed);
    const targetOffsetMin = zoneOffsetMinutes(targetZone, parsed);

    // epoch assuming parsed is UTC; subtract source offset to get true UTC epoch.
    const epoch = parsed.getTime() - sourceOffsetMin * 60000;
    const targetDate = new Date(epoch);

    const targetFmt = dtf(targetZone);
    const sourceFmt = dtf(sourceZone);

    return {
      source: sourceFmt.format(new Date(epoch)),
      target: targetFmt.format(targetDate),
      diffHours: (targetOffsetMin - sourceOffsetMin) / 60,
      targetOffset: localOffset(targetZone),
      sourceOffset: localOffset(sourceZone),
    };
  }, [localInput, sourceZone, targetZone]);

  const setToNow = () => {
    const d = localNowForZone(sourceZone);
    const pad = (n: number) => String(n).padStart(2, "0");
    setLocalInput(
      `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
    );
    setNow(new Date());
  };

  const swap = () => {
    setSourceZone(targetZone);
    setTargetZone(sourceZone);
  };

  return (
    <ClientToolShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-4 w-4" /> Now (your device): {now.toLocaleString()}
          </p>
          <Button size="sm" variant="outline" onClick={setToNow} className="gap-1.5">
            <RefreshCw className="h-4 w-4" /> Set to current time
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="tz-source">Source zone</Label>
            <Select value={sourceZone} onValueChange={setSourceZone}>
              <SelectTrigger id="tz-source"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ZONES.map((z) => (
                  <SelectItem key={z} value={z}>{z.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="datetime-local"
              value={localInput}
              onChange={(e) => setLocalInput(e.target.value)}
            />
          </div>
          <div className="hidden pb-2.5 sm:flex sm:justify-center">
            <Button size="icon" variant="outline" onClick={swap} aria-label="Swap zones">
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tz-target">Target zone</Label>
            <Select value={targetZone} onValueChange={setTargetZone}>
              <SelectTrigger id="tz-target"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ZONES.map((z) => (
                  <SelectItem key={z} value={z}>{z.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              readOnly
              value={converted ? converted.target : ""}
              className="font-mono"
            />
          </div>
        </div>

        {converted && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Source ({sourceZone.replace(/_/g, " ")})</div>
              <div className="mt-1 font-mono text-sm">{converted.source}</div>
              <div className="mt-1 text-xs text-muted-foreground">UTC offset: {converted.sourceOffset || "UTC"}</div>
            </div>
            <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Target ({targetZone.replace(/_/g, " ")})</div>
              <div className="mt-1 font-mono text-sm font-semibold">{converted.target}</div>
              <div className="mt-1 text-xs text-muted-foreground">UTC offset: {converted.targetOffset || "UTC"}</div>
            </div>
          </div>
        )}

        {converted && (
          <div className="rounded-lg border p-3 text-sm">
            Time difference: <span className="font-mono font-semibold">
              {converted.diffHours >= 0 ? "+" : ""}{converted.diffHours} hour{Math.abs(converted.diffHours) === 1 ? "" : "s"}
            </span>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Conversions use your browser's Intl engine with full IANA tz database.
          Daylight saving transitions are handled automatically.
        </p>
      </div>
    </ClientToolShell>
  );
}

// Compute zone offset in minutes for the given epoch ms (uses Intl formatToParts).
function zoneOffsetMinutes(zone: string, date: Date): number {
  const dt = new Date(date.getTime());
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(dt);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const asUtc = Date.UTC(
    parseInt(map.year, 10),
    parseInt(map.month, 10) - 1,
    parseInt(map.day, 10),
    parseInt(map.hour, 10) === 24 ? 0 : parseInt(map.hour, 10),
    parseInt(map.minute, 10),
    parseInt(map.second, 10),
  );
  return Math.round((asUtc - dt.getTime()) / 60000);
}
