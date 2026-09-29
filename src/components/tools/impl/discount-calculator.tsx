'use client'

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClientToolShell } from "@/components/tools/client-tool-shell";
import { BadgePercent, Tag, Wallet } from "lucide-react";

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

export default function DiscountCalculator() {
  const [price, setPrice] = useState("200");
  const [pct, setPct] = useState("25");
  const [symbol, setSymbol] = useState("$");

  const { discountAmount, finalPrice, savings, formulaRows } = useMemo(() => {
    const p = parseFloat(price);
    const d = parseFloat(pct);
    if (isNaN(p) || isNaN(d)) return {
      discountAmount: NaN, finalPrice: NaN, savings: NaN, formulaRows: [] as string[],
    };
    const amount = (d / 100) * p;
    const final = p - amount;
    return {
      discountAmount: amount,
      finalPrice: final,
      savings: amount,
      formulaRows: [
        `Discount amount = Original × (Discount% ÷ 100) = ${currency(p, symbol)} × (${fmt(d)}% ÷ 100) = ${currency(amount, symbol)}`,
        `Final price     = Original − Discount = ${currency(p, symbol)} − ${currency(amount, symbol)} = ${currency(final, symbol)}`,
        `Total savings   = ${currency(amount, symbol)}`,
      ],
    };
  }, [price, pct, symbol]);

  return (
    <ClientToolShell>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="d-price">Original price</Label>
            <Input id="d-price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-pct">Discount (%)</Label>
            <Input id="d-pct" type="number" value={pct} onChange={(e) => setPct(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-sym">Currency</Label>
            <Input id="d-sym" value={symbol} onChange={(e) => setSymbol(e.target.value || "$")} maxLength={3} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard icon={<BadgePercent className="h-4 w-4" />} label="Discount amount" value={currency(discountAmount, symbol)} />
          <StatCard icon={<Tag className="h-4 w-4" />} label="Final price" value={currency(finalPrice, symbol)} highlight />
          <StatCard icon={<Wallet className="h-4 w-4" />} label="You save" value={currency(savings, symbol)} />
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
