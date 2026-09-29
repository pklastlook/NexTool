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

export default function LoanCalculator() {
  const [principal, setPrincipal] = useState("250000");
  const [annualRate, setAnnualRate] = useState("6.5");
  const [years, setYears] = useState("20");
  const [symbol, setSymbol] = useState("$");

  const { monthly, totalPaid, totalInterest, formulaRows, breakdown } = useMemo(() => {
    const P = parseFloat(principal);
    const annual = parseFloat(annualRate);
    const y = parseFloat(years);
    if (isNaN(P) || isNaN(annual) || isNaN(y) || P <= 0 || y <= 0) {
      return { monthly: NaN, totalPaid: NaN, totalInterest: NaN, formulaRows: [] as string[], breakdown: null };
    }
    const n = Math.round(y * 12);            // months
    const r = annual / 100 / 12;             // monthly rate
    let monthlyVal: number;
    if (r === 0) {
      monthlyVal = P / n;
    } else {
      const pow = Math.pow(1 + r, n);
      monthlyVal = (P * r * pow) / (pow - 1);
    }
    const totalPaidVal = monthlyVal * n;
    const totalInterestVal = totalPaidVal - P;

    const formulaRows = [
      `P (principal)        = ${currency(P, symbol)}`,
      `r (monthly rate)     = ${fmt(annual)}% ÷ 12 ÷ 100 = ${r.toFixed(8)}`,
      `n (months)           = ${fmt(y, 0)} × 12 = ${n}`,
      `Monthly payment M    = P × r × (1+r)^n ÷ ((1+r)^n − 1)`,
      `                     = ${currency(P, symbol)} × ${r.toFixed(8)} × ${(1 + r).toFixed(6)}^${n} ÷ (${(1 + r).toFixed(6)}^${n} − 1)`,
      `                     = ${currency(monthlyVal, symbol)}`,
      `Total payment        = M × n = ${currency(monthlyVal, symbol)} × ${n} = ${currency(totalPaidVal, symbol)}`,
      `Total interest       = Total − P = ${currency(totalPaidVal, symbol)} − ${currency(P, symbol)} = ${currency(totalInterestVal, symbol)}`,
    ];
    return {
      monthly: monthlyVal,
      totalPaid: totalPaidVal,
      totalInterest: totalInterestVal,
      formulaRows,
      breakdown: { P, r, n },
    };
  }, [principal, annualRate, years, symbol]);

  return (
    <ClientToolShell>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="ln-p">Principal</Label>
            <Input id="ln-p" type="number" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ln-r">Annual interest rate (%)</Label>
            <Input id="ln-r" type="number" value={annualRate} onChange={(e) => setAnnualRate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ln-y">Term (years)</Label>
            <Input id="ln-y" type="number" value={years} onChange={(e) => setYears(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ln-sym">Currency</Label>
            <Input id="ln-sym" value={symbol} onChange={(e) => setSymbol(e.target.value || "$")} maxLength={3} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            icon={<CalendarClock className="h-4 w-4" />}
            label="Monthly payment"
            value={currency(monthly, symbol)}
            highlight
          />
          <StatCard
            icon={<Banknote className="h-4 w-4" />}
            label="Total payment"
            value={currency(totalPaid, symbol)}
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
            <MiniStat label="Number of payments" value={`${breakdown.n}`} />
            <MiniStat label="Interest ratio" value={isFinite(monthly) ? `${fmt((totalInterest / parseFloat(principal)) * 100, 2)}%` : "—"} />
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
