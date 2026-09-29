'use client'

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, Filter, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CATEGORIES, TOOLS } from "@/lib/tool-registry";
import { ToolIcon } from "@/components/tools/tool-icon";

export function AllToolsClient() {
  const sp = useSearchParams();
  const filter = sp.get("filter");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");

  const list = useMemo(() => {
    let arr = [...TOOLS];
    if (filter === "popular") arr = arr.filter((t) => t.popular);
    if (filter === "featured") arr = arr.filter((t) => t.featured);
    if (cat !== "all") arr = arr.filter((t) => t.category === cat);
    const query = q.trim().toLowerCase();
    if (query) {
      arr = arr.filter((t) =>
        [t.name, t.description, ...t.keywords, t.category].join(" ").toLowerCase().includes(query)
      );
    }
    return arr;
  }, [q, cat, filter]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">All tools</h1>
        <p className="mt-2 text-muted-foreground">
          {TOOLS.length} genuinely working tools across {CATEGORIES.length} categories.
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tools…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={cat === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setCat("all")}
          >
            All
          </Button>
          {CATEGORIES.map((c) => (
            <Button
              key={c.slug}
              variant={cat === c.slug ? "default" : "outline"}
              size="sm"
              onClick={() => setCat(c.slug)}
              className="gap-1.5"
            >
              <ToolIcon name={c.icon} className="h-3.5 w-3.5" />
              {c.name}
            </Button>
          ))}
        </div>
      </div>

      {filter && (
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" /> Showing <Badge variant="secondary">{filter}</Badge> tools
          <Link href="/tools"><Button variant="link" size="sm">Clear filter</Button></Link>
        </div>
      )}

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          <SlidersHorizontal className="mx-auto mb-2 h-6 w-6" />
          No tools match your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((t) => (
            <Link
              key={t.slug}
              href={`/tools/${t.slug}`}
              className="group flex h-full flex-col gap-3 rounded-2xl border bg-card p-5 transition hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md elevated-card"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground transition group-hover:scale-105">
                <ToolIcon name={t.icon} className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <h3 className="font-semibold leading-tight">{t.name}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{t.description}</p>
              </div>
              <div className="text-xs capitalize text-muted-foreground">{t.category.replace("-", " ")}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
