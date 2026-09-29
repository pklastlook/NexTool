'use client'

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Command as CommandPrimitive } from "cmdk";
import { Search, CornerDownLeft, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { CATEGORIES, TOOLS, type ToolDef } from "@/lib/tool-registry";
import { ToolIcon } from "@/components/tools/tool-icon";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  // Reset query when opened
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (open) setQuery("");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open]);

  const go = useCallback(
    (path: string) => {
      onOpenChange(false);
      router.push(path);
    },
    [onOpenChange, router]
  );

  const results = useMemo<ToolDef[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TOOLS.filter((t) => t.popular).slice(0, 8);
    return TOOLS.filter((t) => {
      const hay = [t.name, t.description, ...t.keywords, t.category].join(" ").toLowerCase();
      return hay.includes(q);
    }).slice(0, 12);
  }, [query]);

  const matchedCategories = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CATEGORIES.slice(0, 6);
    return CATEGORIES.filter((c) =>
      [c.name, c.description, c.slug].join(" ").toLowerCase().includes(q)
    ).slice(0, 6);
  }, [query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Search tools</DialogTitle>
          <DialogDescription>
            Search for a tool or category. Use arrow keys to navigate.
          </DialogDescription>
        </DialogHeader>
        <CommandPrimitive className="flex flex-col" loop>
          <div className="flex items-center gap-3 border-b px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <CommandInput
              placeholder="Search tools, categories…"
              className="flex h-14 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
            <kbd className="hidden shrink-0 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
              ESC
            </kbd>
          </div>
          <CommandList className="max-h-[420px] overflow-y-auto p-2">
            <CommandEmpty className="py-10 text-center text-sm text-muted-foreground">
              No tools found for “{query}”.
            </CommandEmpty>

            {results.length > 0 && (
              <CommandGroup heading={query ? "Tools" : "Popular tools"} className="mb-1">
                {results.map((t) => (
                  <CommandItem
                    key={t.slug}
                    value={`${t.name} ${t.keywords.join(" ")}`}
                    onSelect={() => go(`/tools/${t.slug}`)}
                    className="group flex items-center gap-3 rounded-lg px-3 py-2"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <ToolIcon name={t.icon} className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{t.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {t.description}
                      </div>
                    </div>
                    <span className="hidden shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground sm:inline">
                      {t.category}
                    </span>
                    <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition group-aria-selected:opacity-100" />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {matchedCategories.length > 0 && (
              <CommandGroup heading="Categories">
                {matchedCategories.map((c) => (
                  <CommandItem
                    key={c.slug}
                    value={`category ${c.name} ${c.slug}`}
                    onSelect={() => go(`/category/${c.slug}`)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <ToolIcon name={c.icon} className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{c.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {c.description}
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {!query && (
              <CommandGroup heading="Navigate">
                <CommandItem
                  value="go home"
                  onSelect={() => go("/")}
                  className="rounded-lg px-3 py-2"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <ToolIcon name="Home" className="h-4 w-4" />
                  </span>
                  <span className="font-medium">Homepage</span>
                </CommandItem>
                <CommandItem
                  value="all tools"
                  onSelect={() => go("/tools")}
                  className="rounded-lg px-3 py-2"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <ToolIcon name="LayoutGrid" className="h-4 w-4" />
                  </span>
                  <span className="font-medium">All tools</span>
                </CommandItem>
                <CommandItem
                  value="providers integrations status"
                  onSelect={() => go("/status")}
                  className="rounded-lg px-3 py-2"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <ToolIcon name="Activity" className="h-4 w-4" />
                  </span>
                  <span className="font-medium">Provider status</span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </CommandPrimitive>
      </DialogContent>
    </Dialog>
  );
}
