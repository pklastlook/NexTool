'use client'

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Users, Percent } from "lucide-react";
import { ClientToolShell } from "@/components/tools/client-tool-shell";

const money = (n: number) =>
  isFinite(n) ? n.toLocaleString("en-US", { style: "currency", currency: "USD" }) : "—";

export default function TipCalculator() {
  const [bill, setBill] = useState<string>("50.00");
  const [tipPct, setTipPct] = useState<number>(15);
  const [people, setPeople] = useState<string>("1");

  const result = useMemo(() => {
    const b = parseFloat(bill);
    const p = parseInt(people, 10);
    if (!isFinite(b) || b < 0) return null;
    if (!isFinite(p) || p < 1) return null;
    const tip = b * (tipPct / 100);
    const total = b + tip;
    const perPerson = total / p;
    const tipPerPerson = tip / p;
    return { b, tip, total, perPerson, tipPerPerson, p, tipPct };
  }, [bill, tipPct, people]);

  return (
    <ClientToolShell>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="tip-bill">Bill amount</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input
                id="tip-bill"
                type="number"
                min="0"
                step="0.01"
                className="pl-7"
                value={bill}
                onChange={(e) => setBill(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tip-people">Number of people</Label>
            <div className="relative">
              <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="tip-people"
                type="number"
                min="1"
                step="1"
                className="pl-9"
                value={people}
                onChange={(e) => setPeople(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Tip percentage</Label>
            <span className="font-mono text-sm font-medium">{tipPct}%</span>
          </div>
          <Slider
            value={[tipPct]}
            min={0}
            max={50}
            step={1}
            onValueChange={(v) => setTipPct(v[0])}
          />
          <div className="flex flex-wrap gap-2">
            {[10, 15, 18, 20, 25].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setTipPct(p)}
                className={`rounded-md border px-3 py-1 text-sm transition ${
                  tipPct === p
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                {p}%
              </button>
            ))}
          </div>
        </div>

        {result && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border bg-muted/30 p-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Percent className="h-4 w-4" /> Tip
              </div>
              <div className="mt-1 text-2xl font-bold">{money(result.tip)}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {money(result.tipPerPerson)} / person
              </div>
            </div>
            <div className="rounded-xl border border-primary/40 bg-primary/5 p-5">
              <div className="text-sm text-muted-foreground">Total bill</div>
              <div className="mt-1 text-3xl font-bold text-primary">{money(result.total)}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {money(result.perPerson)} / person ({result.p} {result.p === 1 ? "person" : "people"})
              </div>
            </div>
          </div>
        )}

        {result && (
          <div className="rounded-lg border p-4 text-sm">
            <div className="mb-2 font-medium">Breakdown</div>
            <div className="space-y-1 font-mono text-xs">
              <Row label="Bill subtotal" value={money(result.b)} />
              <Row label={`Tip (${result.tipPct}%)`} value={money(result.tip)} />
              <div className="my-1 border-t" />
              <Row label="Grand total" value={money(result.total)} bold />
              <Row label={`÷ ${result.p} ${result.p === 1 ? "person" : "people"}`} value={money(result.perPerson)} />
            </div>
          </div>
        )}
      </div>
    </ClientToolShell>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <span className={bold ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}
