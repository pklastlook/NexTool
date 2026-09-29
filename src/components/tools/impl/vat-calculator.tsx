'use client'

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ClientToolShell } from "@/components/tools/client-tool-shell";
import { Plus, Minus, Receipt } from "lucide-react";

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

export default function VatCalculator() {
  const [tab, setTab] = useState<"add" | "remove">("add");
  const [amount, setAmount] = useState("100");
  const [rate, setRate] = useState("20");
  const [symbol, setSymbol] = useState("$");

  const { net, vat, gross, formulaRows } = useMemo(() => {
    const a = parseFloat(amount);
    const r = parseFloat(rate);
    if (isNaN(a) || isNaN(r)) return { net: NaN, vat: NaN, gross: NaN, formulaRows: [] as string[] };

    if (tab === "add") {
      // amount is net; gross = amount × (1 + r/100); vat = gross − net
      const netVal = a;
      const grossVal = a * (1 + r / 100);
      const vatVal = grossVal - netVal;
      return {
        net: netVal, vat: vatVal, gross: grossVal,
        formulaRows: [
          `Gross = Net × (1 + Rate% ÷ 100) = ${currency(a, symbol)} × (1 + ${fmt(r)}% ÷ 100) = ${currency(grossVal, symbol)}`,
          `VAT   = Gross − Net = ${currency(grossVal, symbol)} − ${currency(netVal, symbol)} = ${currency(vatVal, symbol)}`,
        ],
      };
    } else {
      // amount is gross; net = amount ÷ (1 + r/100); vat = amount − net
      const grossVal = a;
      const netVal = a / (1 + r / 100);
      const vatVal = a - netVal;
      return {
        net: netVal, vat: vatVal, gross: grossVal,
        formulaRows: [
          `Net  = Gross ÷ (1 + Rate% ÷ 100) = ${currency(a, symbol)} ÷ (1 + ${fmt(r)}% ÷ 100) = ${currency(netVal, symbol)}`,
          `VAT  = Gross − Net = ${currency(grossVal, symbol)} − ${currency(netVal, symbol)} = ${currency(vatVal, symbol)}`,
        ],
      };
    }
  }, [tab, amount, rate, symbol]);

  return (
    <ClientToolShell>
      <div className="space-y-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "add" | "remove")}>
          <TabsList className="w-full justify-start">
            <TabsTrigger value="add" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Add VAT</TabsTrigger>
            <TabsTrigger value="remove" className="gap-1.5"><Minus className="h-3.5 w-3.5" /> Remove VAT</TabsTrigger>
          </TabsList>

          <TabsContent value="add">
            <p className="mb-3 text-sm text-muted-foreground">
              Enter the <strong>net (excluding VAT)</strong> amount to compute the VAT and gross (incl. VAT) values.
            </p>
          </TabsContent>
          <TabsContent value="remove">
            <p className="mb-3 text-sm text-muted-foreground">
              Enter the <strong>gross (including VAT)</strong> amount to back-calculate the VAT and net values.
            </p>
          </TabsContent>
        </Tabs>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="vat-amt">Amount</Label>
            <Input id="vat-amt" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vat-rate">VAT rate (%)</Label>
            <Input id="vat-rate" type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vat-sym">Currency</Label>
            <Input id="vat-sym" value={symbol} onChange={(e) => setSymbol(e.target.value || "$")} maxLength={3} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Net (excl. VAT)" value={currency(net, symbol)} />
          <StatCard icon={<Receipt className="h-4 w-4" />} label="VAT amount" value={currency(vat, symbol)} highlight />
          <StatCard label="Gross (incl. VAT)" value={currency(gross, symbol)} />
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
}: { icon?: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? "border-emerald-500/40 bg-emerald-500/5" : ""}`}>
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon}{label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
