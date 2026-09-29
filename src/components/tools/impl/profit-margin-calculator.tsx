'use client'

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClientToolShell } from "@/components/tools/client-tool-shell";
import { Coins, TrendingUp, Tag, Repeat } from "lucide-react";

function fmt(n: number, digits = 2): string {
  if (!isFinite(n)) return "—";
  return Number(n.toFixed(digits)).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function currency(n: number, currency = "$"): string {
  if (!isFinite(n)) return "—";
  return `${currency}${fmt(n, 2)}`;
}

interface ResultRow {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  highlight?: boolean;
}

export default function ProfitMarginCalculator() {
  const [cost, setCost] = useState("80");
  const [price, setPrice] = useState("120");
  const [symbol, setSymbol] = useState("$");

  const { profit, margin, markup, rows, formulaRows } = useMemo(() => {
    const c = parseFloat(cost);
    const p = parseFloat(price);
    if (isNaN(c) || isNaN(p)) return {
      profit: NaN, margin: NaN, markup: NaN, rows: [] as ResultRow[], formulaRows: [] as string[],
    };
    const profitVal = p - c;
    const marginVal = p !== 0 ? (profitVal / p) * 100 : NaN;
    const markupVal = c !== 0 ? (profitVal / c) * 100 : NaN;
    const rows: ResultRow[] = [
      { label: "Profit", value: currency(profitVal, symbol), icon: <Coins className="h-4 w-4" />, hint: "Price − Cost", highlight: true },
      { label: "Margin", value: isFinite(marginVal) ? `${fmt(marginVal, 2)}%` : "—", icon: <TrendingUp className="h-4 w-4" />, hint: "Profit ÷ Price × 100" },
      { label: "Markup", value: isFinite(markupVal) ? `${fmt(markupVal, 2)}%` : "—", icon: <Tag className="h-4 w-4" />, hint: "Profit ÷ Cost × 100" },
    ];
    const formulaRows = [
      `Profit  = Price − Cost = ${currency(p, symbol)} − ${currency(c, symbol)} = ${currency(profitVal, symbol)}`,
      `Margin  = Profit ÷ Price × 100 = ${currency(profitVal, symbol)} ÷ ${currency(p, symbol)} × 100 = ${fmt(marginVal, 2)}%`,
      `Markup  = Profit ÷ Cost × 100 = ${currency(profitVal, symbol)} ÷ ${currency(c, symbol)} × 100 = ${fmt(markupVal, 2)}%`,
    ];
    return { profit: profitVal, margin: marginVal, markup: markupVal, rows, formulaRows };
  }, [cost, price, symbol]);

  return (
    <ClientToolShell>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="pm-cost">Cost</Label>
            <Input id="pm-cost" type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pm-price">Selling price</Label>
            <Input id="pm-price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pm-sym">Currency</Label>
            <Input id="pm-sym" value={symbol} onChange={(e) => setSymbol(e.target.value || "$")} maxLength={3} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {rows.map((r) => (
            <div
              key={r.label}
              className={`rounded-lg border p-4 ${r.highlight ? "border-emerald-500/40 bg-emerald-500/5" : ""}`}
            >
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                {r.icon}
                {r.label}
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{r.value}</div>
              {r.hint && <div className="mt-1 text-xs text-muted-foreground">{r.hint}</div>}
            </div>
          ))}
        </div>

        <div className="rounded-lg bg-muted/60 p-3 font-mono text-xs leading-relaxed text-muted-foreground">
          {formulaRows.map((f, i) => <div key={i}>{f}</div>)}
        </div>
      </div>
    </ClientToolShell>
  );
}
