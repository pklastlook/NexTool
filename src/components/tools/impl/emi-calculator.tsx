'use client'

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClientToolShell } from "@/components/tools/client-tool-shell";
import { CalendarClock, Banknote, Percent } from "lucide-react";

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

export default function EmiCalculator() {
  const [principal, setPrincipal] = useState("500000");
  const [annualRate, setAnnualRate] = useState("9");
  const [months, setMonths] = useState("60");
  const [symbol, setSymbol] = useState("₹");

  const { emi, totalPayable, totalInterest, formulaRows, breakdown } = useMemo(() => {
    const P = parseFloat(principal);
    const annual = parseFloat(annualRate);
    const m = parseFloat(months);
    if (isNaN(P) || isNaN(annual) || isNaN(m) || P <= 0 || m <= 0) {
      return { emi: NaN, totalPayable: NaN, totalInterest: NaN, formulaRows: [] as string[], breakdown: null };
    }
    const n = Math.round(m);
    const r = annual / 100 / 12;             // monthly rate
    let emiVal: number;
    if (r === 0) {
      emiVal = P / n;
    } else {
      const pow = Math.pow(1 + r, n);
      emiVal = (P * r * pow) / (pow - 1);
    }
    const totalPayableVal = emiVal * n;
    const totalInterestVal = totalPayableVal - P;

    const formulaRows = [
      `P (principal)        = ${currency(P, symbol)}`,
      `r (monthly rate)     = ${fmt(annual)}% ÷ 12 ÷ 100 = ${r.toFixed(8)}`,
      `n (months)           = ${n}`,
      `EMI = P × r × (1+r)^n ÷ ((1+r)^n − 1)`,
      `    = ${currency(P, symbol)} × ${r.toFixed(8)} × ${(1 + r).toFixed(6)}^${n} ÷ (${(1 + r).toFixed(6)}^${n} − 1)`,
      `    = ${currency(emiVal, symbol)}`,
      `Total payable = EMI × n = ${currency(emiVal, symbol)} × ${n} = ${currency(totalPayableVal, symbol)}`,
      `Total interest = Total − P = ${currency(totalPayableVal, symbol)} − ${currency(P, symbol)} = ${currency(totalInterestVal, symbol)}`,
    ];
    return {
      emi: emiVal,
      totalPayable: totalPayableVal,
      totalInterest: totalInterestVal,
      formulaRows,
      breakdown: { P, r, n },
    };
  }, [principal, annualRate, months, symbol]);

  return (
    <ClientToolShell>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="emi-p">Principal</Label>
            <Input id="emi-p" type="number" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emi-r">Annual interest rate (%)</Label>
            <Input id="emi-r" type="number" value={annualRate} onChange={(e) => setAnnualRate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emi-n">Tenure (months)</Label>
            <Input id="emi-n" type="number" value={months} onChange={(e) => setMonths(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emi-sym">Currency</Label>
            <Input id="emi-sym" value={symbol} onChange={(e) => setSymbol(e.target.value || "₹")} maxLength={3} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            icon={<CalendarClock className="h-4 w-4" />}
            label="Monthly EMI"
            value={currency(emi, symbol)}
            highlight
          />
          <StatCard
            icon={<Banknote className="h-4 w-4" />}
            label="Total payable"
            value={currency(totalPayable, symbol)}
          />
          <StatCard
            icon={<Percent className="h-4 w-4" />}
            label="Total interest"
            value={currency(totalInterest, symbol)}
          />
        </div>

        {breakdown && (
          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            <MiniStat label="Monthly rate" value={`${(breakdown.r * 100).toFixed(6)}%`} />
            <MiniStat label="Number of EMIs" value={`${breakdown.n}`} />
            <MiniStat label="Interest ratio" value={isFinite(emi) ? `${fmt((totalInterest / parseFloat(principal)) * 100, 2)}%` : "—"} />
          </div>
        )}

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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium tabular-nums">{value}</div>
    </div>
  );
}
