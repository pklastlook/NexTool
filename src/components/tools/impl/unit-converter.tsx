'use client'

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRight } from "lucide-react";
import { ClientToolShell } from "@/components/tools/client-tool-shell";

type Category = "length" | "weight" | "temperature" | "speed" | "data";

// Conversion factors: how many base units is 1 of this unit?
// Length base: meter
const LENGTH: Record<string, number> = {
  m: 1, km: 1000, cm: 0.01, mm: 0.001,
  in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344,
};
// Weight base: gram
const WEIGHT: Record<string, number> = {
  mg: 0.001, g: 1, kg: 1000, t: 1_000_000,
  oz: 28.349523125, lb: 453.59237,
};
// Speed base: m/s
const SPEED: Record<string, number> = {
  "m/s": 1, "km/h": 0.277777778, mph: 0.44704, knot: 0.514444444,
};
// Data base: byte (using binary prefixes 1024 for simplicity)
const DATA: Record<string, number> = {
  B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4,
};
// Temperature handled separately
const TEMP_UNITS = ["C", "F", "K"];

const CATEGORY_UNITS: Record<Category, string[]> = {
  length: Object.keys(LENGTH),
  weight: Object.keys(WEIGHT),
  temperature: TEMP_UNITS,
  speed: Object.keys(SPEED),
  data: Object.keys(DATA),
};

function tempToC(value: number, unit: string): number {
  if (unit === "C") return value;
  if (unit === "F") return (value - 32) * (5 / 9);
  return value - 273.15; // K
}
function tempFromC(c: number, unit: string): number {
  if (unit === "C") return c;
  if (unit === "F") return c * (9 / 5) + 32;
  return c + 273.15; // K
}

function convert(value: number, from: string, to: string, cat: Category): number {
  if (cat === "temperature") {
    return tempFromC(tempToC(value, from), to);
  }
  const table = cat === "length" ? LENGTH : cat === "weight" ? WEIGHT : cat === "speed" ? SPEED : DATA;
  const base = value * table[from];
  return base / table[to];
}

function formatNum(n: number): string {
  if (!isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs === 0) return "0";
  if (abs >= 1e9 || abs < 1e-6) return n.toExponential(4);
  const digits = abs >= 1000 ? 4 : abs >= 1 ? 6 : 8;
  return Number(n.toPrecision(digits)).toString();
}

export default function UnitConverter() {
  const [category, setCategory] = useState<Category>("length");
  const [value, setValue] = useState<string>("1");
  const [from, setFrom] = useState<string>("m");
  const [to, setTo] = useState<string>("ft");

  const result = useMemo(() => {
    const v = parseFloat(value);
    if (!isFinite(v)) return null;
    const units = CATEGORY_UNITS[category];
    if (!units.includes(from) || !units.includes(to)) return null;
    const out = convert(v, from, to, category);
    const formula =
      category === "temperature"
        ? `${v}°${from} → ${formatNum(out)}°${to}`
        : `1 ${from} = ${formatNum(convert(1, from, to, category))} ${to}`;
    return { out, formula };
  }, [value, from, to, category]);

  // Reset to defaults for a category on change
  const switchCategory = (c: Category) => {
    setCategory(c);
    const units = CATEGORY_UNITS[c];
    setFrom(units[0]);
    setTo(units[1]);
  };

  const units = CATEGORY_UNITS[category];

  return (
    <ClientToolShell>
      <div className="space-y-4">
        <Tabs value={category} onValueChange={(v) => switchCategory(v as Category)}>
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5">
            <TabsTrigger value="length">Length</TabsTrigger>
            <TabsTrigger value="weight">Weight</TabsTrigger>
            <TabsTrigger value="temperature">Temp</TabsTrigger>
            <TabsTrigger value="speed">Speed</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor="uc-from-value">From value</Label>
            <Input
              id="uc-from-value"
              type="number"
              step="any"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <Select value={from} onValueChange={setFrom}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {units.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="hidden pb-[2.6rem] sm:flex sm:justify-center">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="uc-to-value">To value</Label>
            <Input
              id="uc-to-value"
              readOnly
              value={result ? formatNum(result.out) : ""}
              className="font-mono"
            />
            <Select value={to} onValueChange={setTo}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {units.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {result && (
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Conversion</div>
            <div className="mt-1 font-mono text-sm">{result.formula}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">
              {formatNum(parseFloat(value))} {from} = {formatNum(result.out)} {to}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Length: m, km, cm, mm, in, ft, yd, mi · Weight: mg, g, kg, t, oz, lb ·
          Temperature: °C, °F, K · Speed: m/s, km/h, mph, knot · Data: B, KB, MB, GB, TB (binary).
        </p>
      </div>
    </ClientToolShell>
  );
}
