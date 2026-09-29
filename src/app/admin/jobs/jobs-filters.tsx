"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUSES = [
  "created",
  "queued",
  "validating",
  "scanning",
  "processing",
  "validating_output",
  "completed",
  "failed",
  "cancelled",
  "expired",
];

const QUEUES = [
  "pdf",
  "office",
  "image",
  "media",
  "ocr",
  "creative",
  "documents",
  "developer",
  "calculators",
  "seo",
  "social",
  "qr-barcode",
  "text",
  "business",
  "ecommerce",
  "video-audio",
];

export function JobsFilters({
  currentStatus,
  currentQueue,
}: {
  currentStatus?: string;
  currentQueue?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function navigate(next: { status?: string; queue?: string }) {
    const sp = new URLSearchParams(params?.toString() ?? "");
    if (next.status !== undefined) {
      if (next.status === "all") sp.delete("status");
      else sp.set("status", next.status);
    }
    if (next.queue !== undefined) {
      if (next.queue === "all") sp.delete("queue");
      else sp.set("queue", next.queue);
    }
    sp.delete("page");
    startTransition(() => router.push(`/admin/jobs?${sp.toString()}`));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={currentStatus ?? "all"}
        onValueChange={(v) => navigate({ status: v })}
      >
        <SelectTrigger size="sm" className="w-[160px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Status</SelectLabel>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <Select
        value={currentQueue ?? "all"}
        onValueChange={(v) => navigate({ queue: v })}
      >
        <SelectTrigger size="sm" className="w-[180px]">
          <SelectValue placeholder="Queue" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Queue</SelectLabel>
            <SelectItem value="all">All queues</SelectItem>
            {QUEUES.map((q) => (
              <SelectItem key={q} value={q}>{q}</SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      {pending && (
        <span className="text-xs text-muted-foreground">Updating…</span>
      )}
    </div>
  );
}
