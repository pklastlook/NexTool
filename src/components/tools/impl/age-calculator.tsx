'use client'

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CalendarDays, RotateCcw } from "lucide-react";
import { ClientToolShell } from "@/components/tools/client-tool-shell";

interface AgeBreakdown {
  years: number;
  months: number;
  days: number;
  totalDays: number;
  totalHours: number;
  totalMinutes: number;
  totalWeeks: number;
  nextBirthday: { years: number; months: number; days: number; weekday: string } | null;
}

function daysInMonth(year: number, monthIdx: number): number {
  return new Date(year, monthIdx + 1, 0).getDate();
}

function computeAge(birth: Date, now: Date): AgeBreakdown {
  // Compute calendar-year age breakdown.
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  let days = now.getDate() - birth.getDate();

  if (days < 0) {
    // borrow days from previous month
    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    days += daysInMonth(prevYear, prevMonth);
    months -= 1;
  }
  if (months < 0) {
    months += 12;
    years -= 1;
  }

  const ms = now.getTime() - birth.getTime();
  const totalMinutes = Math.floor(ms / 60000);
  const totalHours = Math.floor(ms / 3600000);
  const totalDays = Math.floor(ms / 86400000);
  const totalWeeks = Math.floor(totalDays / 7);

  // Next birthday countdown
  let nextBirthday: AgeBreakdown["nextBirthday"] = null;
  try {
    const thisYearBday = new Date(now.getFullYear(), birth.getMonth(), birth.getDate());
    const nextBday = thisYearBday.getTime() < now.getTime()
      ? new Date(now.getFullYear() + 1, birth.getMonth(), birth.getDate())
      : thisYearBday;
    if (!isNaN(nextBday.getTime())) {
      let nby = nextBday.getFullYear() - now.getFullYear();
      let nbm = nextBday.getMonth() - now.getMonth();
      let nbd = nextBday.getDate() - now.getDate();
      if (nbd < 0) {
        const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        nbd += daysInMonth(prevYear, prevMonth);
        nbm -= 1;
      }
      if (nbm < 0) {
        nbm += 12;
        nby -= 1;
      }
      const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(nextBday);
      nextBirthday = { years: nby, months: nbm, days: nbd, weekday };
    }
  } catch {
    nextBirthday = null;
  }

  return { years, months, days, totalDays, totalHours, totalMinutes, totalWeeks, nextBirthday };
}

export default function AgeCalculator() {
  const [birth, setBirth] = useState<string>("");
  const [now, setNow] = useState<Date>(new Date());

  const result = useMemo(() => {
    if (!birth) return null;
    const b = new Date(birth + "T00:00:00");
    if (isNaN(b.getTime())) return null;
    if (b.getTime() > now.getTime()) return "future";
    return computeAge(b, now);
  }, [birth, now]);

  const refresh = () => setNow(new Date());

  return (
    <ClientToolShell>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="age-birth">Date of birth</Label>
            <Input
              id="age-birth"
              type="date"
              value={birth}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setBirth(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={refresh} className="gap-2 w-full">
              <CalendarDays className="h-4 w-4" />
              Refresh to now ({now.toLocaleString()})
            </Button>
          </div>
        </div>

        {result === "future" && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
            Date of birth is in the future. Please pick a date that has already passed.
          </div>
        )}

        {result && result !== "future" && (
          <>
            <div className="rounded-xl border bg-muted/30 p-5">
              <div className="text-sm text-muted-foreground">Exact age</div>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-3xl font-bold tracking-tight text-primary">{result.years}</span>
                <span className="text-sm">years</span>
                <span className="text-2xl font-semibold">{result.months}</span>
                <span className="text-sm">months</span>
                <span className="text-2xl font-semibold">{result.days}</span>
                <span className="text-sm">days</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Total days" value={result.totalDays.toLocaleString()} />
              <Stat label="Total weeks" value={result.totalWeeks.toLocaleString()} />
              <Stat label="Total hours" value={result.totalHours.toLocaleString()} />
              <Stat label="Total minutes" value={result.totalMinutes.toLocaleString()} />
            </div>

            {result.nextBirthday && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Next birthday</span>
                </div>
                <p className="mt-2 text-lg">
                  In <span className="font-bold text-primary">
                    {result.nextBirthday.months} months and {result.nextBirthday.days} days
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Falling on a {result.nextBirthday.weekday}.
                </p>
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => { setBirth(""); setNow(new Date()); }} className="gap-1.5">
                <RotateCcw className="h-4 w-4" /> Reset
              </Button>
            </div>
          </>
        )}
      </div>
    </ClientToolShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
