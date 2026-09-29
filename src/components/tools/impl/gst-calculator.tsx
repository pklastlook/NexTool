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

export default function GstCalculator() {
  const [tab, setTab] = useState<"add" | "remove">("add");
  const [amount, setAmount] = useState("1000");
  const [rate, setRate] = useState("18");
  const [symbol, setSymbol] = useState("₹");

  const { net, gst, gross, formulaRows } = useMemo(() => {
    const a = parseFloat(amount);
    const r = parseFloat(rate);
    if (isNaN(a) || isNaN(r)) return { net: NaN, gst: NaN, gross: NaN, formulaRows: [] as string[] };

    if (tab === "add") {
      const netVal = a;
      const grossVal = a * (1 + r / 100);
      const gstVal = grossVal - netVal;
      return {
        net: netVal, gst: gstVal, gross: grossVal,
        formulaRows: [
          `Gross = Net × (1 + GST% ÷ 100) = ${currency(a, symbol)} × (1 + ${fmt(r)}% ÷ 100) = ${currency(grossVal, symbol)}`,
          `GST   = Gross − Net = ${currency(grossVal, symbol)} − ${currency(netVal, symbol)} = ${currency(gstVal, symbol)}`,
        ],
      };
    } else {
      const grossVal = a;
      const netVal = a / (1 + r / 100);
      const gstVal = a - netVal;
      return {
        net: netVal, gst: gstVal, gross: grossVal,
        formulaRows: [
          `Net = Gross ÷ (1 + GST% ÷ 100) = ${currency(a, symbol)} ÷ (1 + ${fmt(r)}% ÷ 100) = ${currency(netVal, symbol)}`,
          `GST = Gross − Net = ${currency(grossVal, symbol)} − ${currency(netVal, symbol)} = ${currency(gstVal, symbol)}`,
        ],
      };
    }
  }, [tab, amount, rate, symbol]);

  return (
    <ClientToolShell>
      <div className="space-y-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "add" | "remove")}>
          <TabsList className="w-full justify-start">
            <TabsTrigger value="add" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Add GST</TabsTrigger>
            <TabsTrigger value="remove" className="gap-1.5"><Minus className="h-3.5 w-3.5" /> Remove GST</TabsTrigger>
          </TabsList>

          <TabsContent value="add">
            <p className="mb-3 text-sm text-muted-foreground">
              Enter the <strong>net (excluding GST)</strong> amount to compute GST and the gross (incl. GST) value.
            </p>
          </TabsContent>
          <TabsContent value="remove">
            <p className="mb-3 text-sm text-muted-foreground">
              Enter the <strong>gross (including GST)</strong> amount to back-calculate the GST and net values.
            </p>
          </TabsContent>
        </Tabs>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="gst-amt">Amount</Label>
            <Input id="gst-amt" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gst-rate">GST rate (%)</Label>
            <Input id="gst-rate" type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gst-sym">Currency</Label>
            <Input id="gst-sym" value={symbol} onChange={(e) => setSymbol(e.target.value || "₹")} maxLength={3} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Net (excl. GST)" value={currency(net, symbol)} />
          <StatCard icon={<Receipt className="h-4 w-4" />} label="GST amount" value={currency(gst, symbol)} highlight />
          <StatCard label="Gross (incl. GST)" value={currency(gross, symbol)} />
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
