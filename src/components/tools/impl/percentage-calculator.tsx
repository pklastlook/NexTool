'use client'

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ClientToolShell } from "@/components/tools/client-tool-shell";
import { Percent, TrendingUp, Sigma } from "lucide-react";

function fmt(n: number, digits = 4): string {
  if (!isFinite(n)) return "—";
  return Number(n.toFixed(digits)).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export default function PercentageCalculator() {
  return (
    <ClientToolShell>
      <div className="space-y-4">
        <Tabs defaultValue="what-pct">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="what-pct" className="gap-1.5"><Percent className="h-3.5 w-3.5" /> X is what % of Y</TabsTrigger>
            <TabsTrigger value="pct-of" className="gap-1.5"><Sigma className="h-3.5 w-3.5" /> X% of Y</TabsTrigger>
            <TabsTrigger value="change" className="gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> % Change</TabsTrigger>
          </TabsList>

          <TabsContent value="what-pct"><WhatPctOfY /></TabsContent>
          <TabsContent value="pct-of"><PctOfY /></TabsContent>
          <TabsContent value="change"><PctChange /></TabsContent>
        </Tabs>
      </div>
    </ClientToolShell>
  );
}

function ResultCard({
  formula, result, resultLabel,
}: { formula: string; result: string; resultLabel: string }) {
  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{resultLabel}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{result}</p>
      <div className="mt-3 rounded-md bg-muted/70 p-2 font-mono text-xs text-muted-foreground">
        {formula}
      </div>
    </div>
  );
}

function WhatPctOfY() {
  const [x, setX] = useState("25");
  const [y, setY] = useState("200");

  const { result, formula } = useMemo(() => {
    const xv = parseFloat(x);
    const yv = parseFloat(y);
    if (isNaN(xv) || isNaN(yv) || yv === 0) return { result: "—", formula: "" };
    const pct = (xv / yv) * 100;
    return {
      result: `${fmt(pct, 4)}%`,
      formula: `(${fmt(xv)} ÷ ${fmt(yv)}) × 100 = ${fmt(pct, 4)}%`,
    };
  }, [x, y]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="wp-x">Value X</Label>
          <Input id="wp-x" type="number" value={x} onChange={(e) => setX(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wp-y">Total Y</Label>
          <Input id="wp-y" type="number" value={y} onChange={(e) => setY(e.target.value)} />
        </div>
      </div>
      <ResultCard resultLabel="Result" formula={formula} result={result} />
    </div>
  );
}

function PctOfY() {
  const [pct, setPct] = useState("15");
  const [y, setY] = useState("200");

  const { result, formula } = useMemo(() => {
    const pv = parseFloat(pct);
    const yv = parseFloat(y);
    if (isNaN(pv) || isNaN(yv)) return { result: "—", formula: "" };
    const out = (pv / 100) * yv;
    return {
      result: fmt(out, 4),
      formula: `(${fmt(pv)}% ÷ 100) × ${fmt(yv)} = ${fmt(out, 4)}`,
    };
  }, [pct, y]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="po-pct">Percentage (%)</Label>
          <Input id="po-pct" type="number" value={pct} onChange={(e) => setPct(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="po-y">Value Y</Label>
          <Input id="po-y" type="number" value={y} onChange={(e) => setY(e.target.value)} />
        </div>
      </div>
      <ResultCard resultLabel="Result" formula={formula} result={result} />
    </div>
  );
}

function PctChange() {
  const [from, setFrom] = useState("100");
  const [to, setTo] = useState("150");

  const { result, formula, direction } = useMemo(() => {
    const fv = parseFloat(from);
    const tv = parseFloat(to);
    if (isNaN(fv) || isNaN(tv) || fv === 0) return { result: "—", formula: "", direction: "—" as const };
    const diff = tv - fv;
    const pct = (diff / Math.abs(fv)) * 100;
    const dir = pct > 0 ? "increase" : pct < 0 ? "decrease" : "no change";
    return {
      result: `${fmt(pct, 4)}%`,
      formula: `((${fmt(tv)} - ${fmt(fv)}) ÷ |${fmt(fv)}|) × 100 = ${fmt(pct, 4)}%`,
      direction: dir,
    };
  }, [from, to]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pc-from">From (original)</Label>
          <Input id="pc-from" type="number" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pc-to">To (new)</Label>
          <Input id="pc-to" type="number" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>
      <ResultCard resultLabel={`% ${direction}`} formula={formula} result={result} />
    </div>
  );
}
