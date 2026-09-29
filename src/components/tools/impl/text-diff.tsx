'use client'

import { useMemo, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowRight, Minus, Plus, Equal, Trash2 } from "lucide-react";
import { ClientToolShell } from "@/components/tools/client-tool-shell";

type Op = "equal" | "added" | "removed";
interface DiffRow { op: Op; left?: string; right?: string; }

/**
 * Compute a line-level LCS diff between two arrays of strings.
 * Returns an ordered list of {op, line} where equal lines are aligned.
 */
function lineDiff(a: string[], b: string[]): DiffRow[] {
  const n = a.length, m = b.length;
  // dp[i][j] = LCS length of a[i..] and b[j..]
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const rows: DiffRow[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ op: "equal", left: a[i], right: b[j] });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ op: "removed", left: a[i] });
      i++;
    } else {
      rows.push({ op: "added", right: b[j] });
      j++;
    }
  }
  while (i < n) rows.push({ op: "removed", left: a[i++] });
  while (j < m) rows.push({ op: "added", right: b[j++] });
  return rows;
}

export default function TextDiff() {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");

  const diff = useMemo(
    () => lineDiff(left.split(/\r?\n/), right.split(/\r?\n/)),
    [left, right]
  );

  const stats = useMemo(() => {
    let added = 0, removed = 0, equal = 0;
    for (const r of diff) {
      if (r.op === "added") added++;
      else if (r.op === "removed") removed++;
      else equal++;
    }
    return { added, removed, equal };
  }, [diff]);

  return (
    <ClientToolShell>
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="td-left">Original text</Label>
            <Textarea
              id="td-left"
              value={left}
              onChange={(e) => setLeft(e.target.value)}
              placeholder="Paste the original text here…"
              className="min-h-[180px] font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="td-right">Modified text</Label>
            <Textarea
              id="td-right"
              value={right}
              onChange={(e) => setRight(e.target.value)}
              placeholder="Paste the modified text here…"
              className="min-h-[180px] font-mono text-xs"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => { setLeft(""); setRight(""); }} className="gap-1.5">
            <Trash2 className="h-4 w-4" /> Clear both
          </Button>
          <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
            <Chip color="emerald" icon={<Plus className="h-3 w-3" />} label="Added" value={stats.added} />
            <Chip color="rose" icon={<Minus className="h-3 w-3" />} label="Removed" value={stats.removed} />
            <Chip color="slate" icon={<Equal className="h-3 w-3" />} label="Common" value={stats.equal} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Diff output</Label>
          <div className="overflow-auto rounded-lg border bg-muted/40 font-mono text-xs">
            {diff.length === 0 || (left === "" && right === "") ? (
              <div className="p-4 text-muted-foreground">Differences will appear here…</div>
            ) : (
              <table className="w-full border-collapse">
                <tbody>
                  {diff.map((row, idx) => (
                    <tr
                      key={idx}
                      className={
                        row.op === "added"
                          ? "bg-emerald-500/10"
                          : row.op === "removed"
                            ? "bg-rose-500/10"
                            : ""
                      }
                    >
                      <td className="w-6 select-none px-2 py-0.5 text-center text-muted-foreground">
                        {row.op === "added" ? "+" : row.op === "removed" ? "-" : " "}
                      </td>
                      <td className="whitespace-pre-wrap break-words px-2 py-0.5">
                        {row.op === "added"
                          ? row.right
                          : row.op === "removed"
                            ? row.left
                            : row.left}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </ClientToolShell>
  );
}

function Chip({
  color, icon, label, value,
}: { color: "emerald" | "rose" | "slate"; icon: React.ReactNode; label: string; value: number }) {
  const palette = {
    emerald: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    rose: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    slate: "border-border bg-muted text-muted-foreground",
  }[color];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 ${palette}`}>
      {icon}
      <span className="font-medium">{label}</span>
      <span className="tabular-nums">{value}</span>
    </span>
  );
}
