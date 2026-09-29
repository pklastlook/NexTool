'use client'

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";
import { ClientToolShell } from "@/components/tools/client-tool-shell";

const money = (n: number) =>
  isFinite(n) ? n.toLocaleString("en-US", { style: "currency", currency: "USD" }) : "—";
const pct = (n: number) => isFinite(n) ? `${n.toFixed(2)}%` : "—";

export default function ProductProfitCalculator() {
  const [cost, setCost] = useState<string>("20.00");
  const [price, setPrice] = useState<string>("49.99");
  const [commission, setCommission] = useState<string>("12");
  const [paymentFee, setPaymentFee] = useState<string>("2.9");
  const [shipping, setShipping] = useState<string>("4.50");
  const [tax, setTax] = useState<string>("0");

  const result = useMemo(() => {
    const c = parseFloat(cost);
    const p = parseFloat(price);
    const comm = parseFloat(commission) || 0;
    const pf = parseFloat(paymentFee) || 0;
    const ship = parseFloat(shipping) || 0;
    const taxPct = parseFloat(tax) || 0;
    if (!isFinite(c) || !isFinite(p)) return null;

    const taxAmount = p * (taxPct / 100);
    const commissionAmount = p * (comm / 100);
    const paymentAmount = p * (pf / 100);
    const totalFees = commissionAmount + paymentAmount + taxAmount + ship;
    const revenue = p;
    const netProfit = revenue - totalFees - c;
    const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
    const markup = c > 0 ? ((revenue - c) / c) * 100 : 0;

    return {
      revenue, commissionAmount, paymentAmount, taxAmount,
      shippingCost: ship, totalFees, netProfit, margin, markup,
      cost: c, profit: netProfit,
    };
  }, [cost, price, commission, paymentFee, shipping, tax]);

  return (
    <ClientToolShell>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Product cost ($)" id="pp-cost" value={cost} onChange={setCost} />
          <Field label="Selling price ($)" id="pp-price" value={price} onChange={setPrice} />
          <Field label="Marketplace commission (%)" id="pp-comm" value={commission} onChange={setCommission} />
          <Field label="Payment processing fee (%)" id="pp-fee" value={paymentFee} onChange={setPaymentFee} />
          <Field label="Shipping cost ($)" id="pp-ship" value={shipping} onChange={setShipping} />
          <Field label="Tax (%)" id="pp-tax" value={tax} onChange={setTax} />
        </div>

        {result && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className={`rounded-xl border p-5 ${result.profit >= 0 ? "border-emerald-500/40 bg-emerald-500/5" : "border-red-500/40 bg-red-500/5"}`}>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {result.profit >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  Net profit
                </div>
                <div className={`mt-1 text-3xl font-bold ${result.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {money(result.netProfit)}
                </div>
                <div className="mt-1 flex gap-2">
                  <Badge variant="outline">Margin {pct(result.margin)}</Badge>
                  <Badge variant="outline">Markup {pct(result.markup)}</Badge>
                </div>
              </div>
              <div className="rounded-xl border bg-muted/30 p-5">
                <div className="text-sm text-muted-foreground">Revenue (price received)</div>
                <div className="mt-1 text-2xl font-bold">{money(result.revenue)}</div>
                <div className="mt-1 text-xs text-muted-foreground">Total fees + cost: {money(result.totalFees + result.cost)}</div>
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="mb-3 font-medium">Breakdown</div>
              <div className="space-y-1.5 font-mono text-sm">
                <Row label="Product cost" value={money(result.cost)} muted />
                <Row label="Selling price" value={money(result.revenue)} />
                <div className="my-1 border-t" />
                <Row label={`Marketplace commission (${commission}%)`} value={`- ${money(result.commissionAmount)}`} muted />
                <Row label={`Payment processing (${paymentFee}%)`} value={`- ${money(result.paymentAmount)}`} muted />
                <Row label={`Tax (${tax}%)`} value={`- ${money(result.taxAmount)}`} muted />
                <Row label="Shipping" value={`- ${money(result.shippingCost)}`} muted />
                <div className="my-1 border-t" />
                <Row label="Total fees + shipping" value={money(result.totalFees)} muted />
                <Row label="Net profit (revenue − fees − cost)" value={money(result.netProfit)} bold />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <Stat label="Profit margin" value={pct(result.margin)} hint="profit / revenue" />
              <Stat label="Markup" value={pct(result.markup)} hint="(price − cost) / cost" />
              <Stat label="Cost ratio" value={pct(result.revenue > 0 ? (result.cost / result.revenue) * 100 : 0)} hint="cost / revenue" />
            </div>
          </>
        )}
      </div>
    </ClientToolShell>
  );
}

function Field({
  label, id, value, onChange,
}: { label: string; id: string; value: string; onChange: (v: string) => void; }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" min="0" step="any" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span className={bold ? "font-bold" : ""}>{value}</span>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
