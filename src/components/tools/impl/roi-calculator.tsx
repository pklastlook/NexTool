'use client'

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClientToolShell } from "@/components/tools/client-tool-shell";
import { TrendingUp, CalendarRange, Coins } from "lucide-react";

function fmt(n: number, digits = 2): string {
  if (!isFinite(n)) return "—";
  return Number(n.toFixed(digits)).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}
function currency(n: number, sym: string) {
  if (!isFinite(n)) return "—";
  return `${sym}${fmt(n, 2)}`;
}

export default function RoiCalculator() {
  const [initial, setInitial] = useState("10000");
  const [finalValue, setFinalValue] = useState("18500");
  const [years, setYears] = useState("5");
  const [symbol, setSymbol] = useState("$");

  const { roi, annualized, gain, formulaRows } = useMemo(() => {
    const inv = parseFloat(initial);
    const fv = parseFloat(finalValue);
    const y = parseFloat(years);
    if (isNaN(inv) || isNaN(fv) || isNaN(y)) return { roi: NaN, annualized: NaN, gain: NaN, formulaRows: [] as string[] };

    const gainVal = fv - inv;
    const roiVal = inv !== 0 ? (gainVal / inv) * 100 : NaN;
    const annVal = (inv > 0 && fv > 0 && y > 0)
      ? (Math.pow(fv / inv, 1 / y) - 1) * 100
      : NaN;

    const formulaRows = [
      `Gain            = Final − Initial = ${currency(fv, symbol)} − ${currency(inv, symbol)} = ${currency(gainVal, symbol)}`,
      `ROI             = (Gain ÷ Initial) × 100 = (${currency(gainVal, symbol)} ÷ ${currency(inv, symbol)}) × 100 = ${fmt(roiVal, 2)}%`,
      `Annualized ROI  = ((Final ÷ Initial)^(1 ÷ years) − 1) × 100`,
      `                = ((${currency(fv, symbol)} ÷ ${currency(inv, symbol)})^(1 ÷ ${fmt(y, 0)}) − 1) × 100 = ${fmt(annVal, 2)}%`,
    ];
    return { roi: roiVal, annualized: annVal, gain: gainVal, formulaRows };
  }, [initial, finalValue, years, symbol]);

  return (
    <ClientToolShell>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="roi-i">Initial investment</Label>
            <Input id="roi-i" type="number" value={initial} onChange={(e) => setInitial(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="roi-f">Final value</Label>
            <Input id="roi-f" type="number" value={finalValue} onChange={(e) => setFinalValue(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="roi-y">Time period (years)</Label>
            <Input id="roi-y" type="number" value={years} onChange={(e) => setYears(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="roi-sym">Currency</Label>
            <Input id="roi-sym" value={symbol} onChange={(e) => setSymbol(e.target.value || "$")} maxLength={3} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="ROI"
            value={isFinite(roi) ? `${fmt(roi, 2)}%` : "—"}
            highlight
          />
          <StatCard
            icon={<CalendarRange className="h-4 w-4" />}
            label="Annualized ROI"
            value={isFinite(annualized) ? `${fmt(annualized, 2)}%` : "—"}
          />
          <StatCard
            icon={<Coins className="h-4 w-4" />}
            label="Absolute gain"
            value={currency(gain, symbol)}
          />
        </div>

        <div className="rounded-lg bg-muted/60 p-3 font-mono text-xs leading-relaxed text-muted-foreground">
          {formulaRows.map((f, i) => <div key={i}>{f}</div>)}
        </div>
      </div>
    </ClientToolShell>
  );
}

function StatCard({
  icon, label, value, highlight,
}: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? "border-emerald-500/40 bg-emerald-500/5" : ""}`}>
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon}{label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
