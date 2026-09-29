'use client'

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, FileDown, Loader2 } from "lucide-react";
import { ClientToolShell } from "@/components/tools/client-tool-shell";
import { ResultPanel, type RunState } from "@/components/tools/result-panel";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Item { description: string; quantity: number; price: number; }

export default function InvoiceGenerator() {
  const [number, setNumber] = useState("INV-001");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [toName, setToName] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [currency, setCurrency] = useState("$");
  const [taxRate, setTaxRate] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [format, setFormat] = useState("pdf");
  const [items, setItems] = useState<Item[]>([{ description: "", quantity: 1, price: 0 }]);
  const [state, setState] = useState<RunState>("idle");
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<{ key: string; dir: "outputs" | "uploads"; filename: string; mime: string; size: number }>();

  const subtotal = items.reduce((s, i) => s + i.quantity * i.price, 0);
  const discountAmt = (subtotal * discount) / 100;
  const afterDiscount = subtotal - discountAmt;
  const taxAmt = (afterDiscount * taxRate) / 100;
  const total = afterDiscount + taxAmt;

  const fmt = (n: number) => `${currency}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const addItem = () => setItems([...items, { description: "", quantity: 1, price: 0 }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof Item, value: string | number) =>
    setItems(items.map((it, idx) => (idx === i ? { ...it, [field]: field === "description" ? value : Number(value) } : it)));

  const run = async () => {
    setState("running"); setError(undefined);
    try {
      if (!fromName || !toName) throw new Error("Please fill in the From and To names.");
      if (items.length === 0 || !items[0].description) throw new Error("Add at least one line item.");
      const data = {
        type: "invoice" as const, number, date, dueDate: dueDate || undefined,
        from: { name: fromName, address: fromAddress, email: fromEmail },
        to: { name: toName, address: toAddress, email: toEmail },
        items, currency, taxRate, discount, notes,
      };
      const fd = new FormData();
      fd.append("data", JSON.stringify(data));
      fd.append("format", format);
      const res = await fetch("/api/process/invoice-generator", { method: "POST", body: fd });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Generation failed.");
      setResult(json.file);
      setState("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  };

  return (
    <ClientToolShell>
      <div className="space-y-6">
        {/* Meta */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Invoice #</Label>
            <Input value={number} onChange={(e) => setNumber(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Due date (optional)</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Output format</Label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="docx">Word (DOCX)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* From / To */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3 rounded-lg border p-4">
            <h3 className="text-sm font-semibold">From (your business)</h3>
            <Input placeholder="Business name" value={fromName} onChange={(e) => setFromName(e.target.value)} />
            <Textarea placeholder="Address" rows={2} value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} />
            <Input placeholder="Email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} />
          </div>
          <div className="space-y-3 rounded-lg border p-4">
            <h3 className="text-sm font-semibold">Bill to (customer)</h3>
            <Input placeholder="Customer name" value={toName} onChange={(e) => setToName(e.target.value)} />
            <Textarea placeholder="Address" rows={2} value={toAddress} onChange={(e) => setToAddress(e.target.value)} />
            <Input placeholder="Email" value={toEmail} onChange={(e) => setToEmail(e.target.value)} />
          </div>
        </div>

        {/* Items */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Line items</h3>
            <Button size="sm" variant="outline" onClick={addItem} className="gap-1.5"><Plus className="h-4 w-4" /> Add item</Button>
          </div>
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2">
                <Input className="col-span-6" placeholder="Description" value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} />
                <Input className="col-span-2" type="number" min="1" value={item.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} />
                <Input className="col-span-3" type="number" min="0" step="0.01" placeholder="Price" value={item.price} onChange={(e) => updateItem(i, "price", e.target.value)} />
                <Button variant="ghost" size="icon" className="col-span-1" onClick={() => removeItem(i)} disabled={items.length === 1}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </div>

        {/* Totals config */}
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Currency</Label>
            <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Tax %</Label>
            <Input type="number" min="0" step="0.1" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Discount %</Label>
            <Input type="number" min="0" max="100" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Total</Label>
            <div className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm font-semibold">{fmt(total)}</div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Notes (optional)</Label>
          <Textarea placeholder="Payment terms, bank details, thank-you note…" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {/* Live summary */}
        <div className="rounded-lg border bg-muted/40 p-4 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmt(subtotal)}</span></div>
          {discount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount ({discount}%)</span><span>-{fmt(discountAmt)}</span></div>}
          {taxRate > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Tax ({taxRate}%)</span><span>{fmt(taxAmt)}</span></div>}
          <div className="mt-2 flex justify-between border-t pt-2 font-semibold"><span>Total</span><span>{fmt(total)}</span></div>
        </div>

        <Button onClick={run} disabled={state === "running"} size="lg" className="gap-2">
          {state === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          Generate {format.toUpperCase()}
        </Button>

        <ResultPanel state={state} error={error} file={result} onReset={() => setState("idle")} />
      </div>
    </ClientToolShell>
  );
}
