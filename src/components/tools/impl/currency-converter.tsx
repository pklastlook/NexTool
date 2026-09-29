'use client'

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowRight, ArrowLeftRight, Info } from "lucide-react";
import { ClientToolShell } from "@/components/tools/client-tool-shell";

/**
 * STATIC reference exchange rates (1 USD = X currency).
 * Honest disclosure: no live API key is available in the sandbox,
 * so rates are static reference values, NOT real-time market data.
 * Last reviewed: build-time reference set (approximate mid-market values).
 */
const USD_RATES: Record<string, { rate: number; name: string; symbol: string }> = {
  USD: { rate: 1, name: "US Dollar", symbol: "$" },
  EUR: { rate: 0.92, name: "Euro", symbol: "€" },
  GBP: { rate: 0.79, name: "British Pound", symbol: "£" },
  PKR: { rate: 278.5, name: "Pakistani Rupee", symbol: "₨" },
  INR: { rate: 83.3, name: "Indian Rupee", symbol: "₹" },
  AED: { rate: 3.67, name: "UAE Dirham", symbol: "د.إ" },
  SAR: { rate: 3.75, name: "Saudi Riyal", symbol: "﷼" },
  AUD: { rate: 1.52, name: "Australian Dollar", symbol: "A$" },
  CAD: { rate: 1.37, name: "Canadian Dollar", symbol: "C$" },
  JPY: { rate: 156.2, name: "Japanese Yen", symbol: "¥" },
};

const CURRENCY_CODES = Object.keys(USD_RATES);

function fmt(n: number): string {
  if (!isFinite(n)) return "—";
  // Use up to 4 decimals but trim trailing zeros for very small numbers.
  const abs = Math.abs(n);
  let digits = 2;
  if (abs > 0 && abs < 1) digits = 4;
  if (abs >= 1000) digits = 2;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  });
}

export default function CurrencyConverter() {
  const [amount, setAmount] = useState<string>("100");
  const [from, setFrom] = useState<string>("USD");
  const [to, setTo] = useState<string>("EUR");

  const result = useMemo(() => {
    const amt = parseFloat(amount);
    if (!isFinite(amt) || amt < 0) return null;
    const f = USD_RATES[from];
    const t = USD_RATES[to];
    if (!f || !t) return null;
    // Convert via USD: amount_in_usd = amount / fromRatePerUSD
    const usd = amt / f.rate;
    const converted = usd * t.rate;
    const directRate = t.rate / f.rate; // 1 from = X to
    return { amt, converted, directRate, from, to };
  }, [amount, from, to]);

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  return (
    <ClientToolShell>
      <div className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Static reference rates</AlertTitle>
          <AlertDescription>
            No live FX API key is configured, so conversions use a built-in static
            reference table (approximate mid-market values). For real-time trading
            or settlement, use a live data source.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="cc-amount">Amount</Label>
            <Input
              id="cc-amount"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="hidden sm:flex sm:items-center sm:justify-center sm:pb-2.5">
            <Button size="icon" variant="outline" onClick={swap} aria-label="Swap currencies">
              <ArrowLeftRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="cc-from">From</Label>
              <Select value={from} onValueChange={setFrom}>
                <SelectTrigger id="cc-from"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCY_CODES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c} — {USD_RATES[c].name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cc-to">To</Label>
              <Select value={to} onValueChange={setTo}>
                <SelectTrigger id="cc-to"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCY_CODES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c} — {USD_RATES[c].name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="sm:hidden">
          <Button size="sm" variant="outline" onClick={swap} className="w-full gap-2">
            <ArrowLeftRight className="h-4 w-4" /> Swap
          </Button>
        </div>

        {result && (
          <div className="rounded-xl border bg-muted/30 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">Converted amount</span>
              <span className="font-mono text-xs text-muted-foreground">
                1 {result.from} = {fmt(result.directRate)} {result.to}
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight">
                {USD_RATES[result.from].symbol}{fmt(result.amt)} {result.from}
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="text-3xl font-bold tracking-tight text-primary">
                {USD_RATES[result.to].symbol}{fmt(result.converted)} {result.to}
              </span>
            </div>
            <div className="mt-4 grid gap-2 border-t pt-4 text-sm sm:grid-cols-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reference rate used</span>
                <span className="font-mono">1 {result.from} = {fmt(result.directRate)} {result.to}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Inverse rate</span>
                <span className="font-mono">1 {result.to} = {fmt(1 / result.directRate)} {result.from}</span>
              </div>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Supported currencies: {CURRENCY_CODES.join(", ")}. Rates are static
          reference values and may differ from live market rates.
        </p>
      </div>
    </ClientToolShell>
  );
}
