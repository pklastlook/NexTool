'use client'

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ClientToolShell } from "@/components/tools/client-tool-shell";

type Unit = "metric" | "imperial";

interface BmiResult {
  bmi: number;
  category: "Underweight" | "Normal" | "Overweight" | "Obese";
  color: string;
  formula: string;
}

function categoryFor(bmi: number): BmiResult["category"] {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

function categoryColor(c: BmiResult["category"]): string {
  switch (c) {
    case "Underweight": return "text-blue-500";
    case "Normal": return "text-emerald-500";
    case "Overweight": return "text-amber-500";
    case "Obese": return "text-red-500";
  }
}

export default function BmiCalculator() {
  const [unit, setUnit] = useState<Unit>("metric");
  const [weight, setWeight] = useState<string>("70");
  const [heightCm, setHeightCm] = useState<string>("175");
  const [heightFt, setHeightFt] = useState<string>("5");
  const [heightIn, setHeightIn] = useState<string>("9");

  const result = useMemo<BmiResult | null>(() => {
    const w = parseFloat(weight);
    if (!isFinite(w) || w <= 0) return null;

    if (unit === "metric") {
      const hCm = parseFloat(heightCm);
      if (!isFinite(hCm) || hCm <= 0) return null;
      const hM = hCm / 100;
      const bmi = w / (hM * hM);
      const cat = categoryFor(bmi);
      return {
        bmi,
        category: cat,
        color: categoryColor(cat),
        formula: `BMI = ${w} kg / (${hM.toFixed(2)} m)² = ${bmi.toFixed(1)}`,
      };
    } else {
      const ft = parseFloat(heightFt);
      const inch = parseFloat(heightIn) || 0;
      if (!isFinite(ft) || ft < 0 || inch < 0) return null;
      const totalIn = ft * 12 + inch;
      if (totalIn <= 0) return null;
      const bmi = (w / (totalIn * totalIn)) * 703;
      const cat = categoryFor(bmi);
      return {
        bmi,
        category: cat,
        color: categoryColor(cat),
        formula: `BMI = (${w} lb / (${totalIn.toFixed(1)} in)²) × 703 = ${bmi.toFixed(1)}`,
      };
    }
  }, [unit, weight, heightCm, heightFt, heightIn]);

  const healthyWeightRange = useMemo(() => {
    let hM = 0;
    if (unit === "metric") {
      const hCm = parseFloat(heightCm);
      if (!isFinite(hCm) || hCm <= 0) return null;
      hM = hCm / 100;
    } else {
      const ft = parseFloat(heightFt) || 0;
      const inch = parseFloat(heightIn) || 0;
      const totalIn = ft * 12 + inch;
      if (totalIn <= 0) return null;
      hM = totalIn * 0.0254;
    }
    const low = 18.5 * hM * hM;
    const high = 24.9 * hM * hM;
    if (unit === "metric") {
      return `${low.toFixed(1)} kg – ${high.toFixed(1)} kg`;
    }
    return `${(low * 2.20462).toFixed(1)} lb – ${(high * 2.20462).toFixed(1)} lb`;
  }, [unit, heightCm, heightFt, heightIn]);

  return (
    <ClientToolShell>
      <div className="space-y-4">
        <Tabs value={unit} onValueChange={(v) => setUnit(v as Unit)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="metric">Metric (kg / cm)</TabsTrigger>
            <TabsTrigger value="imperial">Imperial (lb / ft·in)</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bmi-weight">Weight ({unit === "metric" ? "kg" : "lb"})</Label>
            <Input
              id="bmi-weight"
              type="number"
              min="0"
              step="any"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>
          {unit === "metric" ? (
            <div className="space-y-1.5">
              <Label htmlFor="bmi-height-cm">Height (cm)</Label>
              <Input
                id="bmi-height-cm"
                type="number"
                min="0"
                step="any"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="bmi-height-ft">Height (ft)</Label>
                <Input
                  id="bmi-height-ft"
                  type="number"
                  min="0"
                  step="any"
                  value={heightFt}
                  onChange={(e) => setHeightFt(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bmi-height-in">Height (in)</Label>
                <Input
                  id="bmi-height-in"
                  type="number"
                  min="0"
                  max="11"
                  step="any"
                  value={heightIn}
                  onChange={(e) => setHeightIn(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {result && (
          <div className="rounded-xl border bg-muted/30 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm text-muted-foreground">Your BMI</div>
                <div className="text-4xl font-bold tabular-nums">{result.bmi.toFixed(1)}</div>
              </div>
              <Badge
                variant="outline"
                className={`px-3 py-1 text-sm font-medium ${result.color}`}
              >
                {result.category}
              </Badge>
            </div>
            <p className="mt-3 font-mono text-xs text-muted-foreground">{result.formula}</p>
          </div>
        )}

        {healthyWeightRange && (
          <div className="rounded-lg border p-4 text-sm">
            <span className="text-muted-foreground">Healthy weight range for your height: </span>
            <span className="font-semibold">{healthyWeightRange}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
          <CategoryChip label="Underweight" range="< 18.5" color="text-blue-500" />
          <CategoryChip label="Normal" range="18.5 – 24.9" color="text-emerald-500" />
          <CategoryChip label="Overweight" range="25 – 29.9" color="text-amber-500" />
          <CategoryChip label="Obese" range="≥ 30" color="text-red-500" />
        </div>

        <p className="text-xs text-muted-foreground">
          BMI is a screening metric and does not account for muscle mass, bone
          density, age, or sex. Consult a healthcare provider for medical advice.
        </p>
      </div>
    </ClientToolShell>
  );
}

function CategoryChip({ label, range, color }: { label: string; range: string; color: string }) {
  return (
    <div className="rounded-lg border bg-card p-2.5">
      <div className={`font-medium ${color}`}>{label}</div>
      <div className="text-muted-foreground">{range}</div>
    </div>
  );
}
