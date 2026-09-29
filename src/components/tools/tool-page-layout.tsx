'use client'

import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type ToolDef, getCategory, toolsByCategory } from "@/lib/tool-registry";
import { ToolIcon } from "@/components/tools/tool-icon";

interface ToolPageLayoutProps {
  tool: ToolDef;
  children: React.ReactNode;
}

export function ToolPageLayout({ tool, children }: ToolPageLayoutProps) {
  const category = getCategory(tool.category);
  const related = toolsByCategory(tool.category)
    .filter((t) => t.slug !== tool.slug)
    .slice(0, 6);

  return (
    <div className="mx-auto max-w-4xl px-1 py-6 sm:py-8">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href={`/category/${tool.category}`} className="hover:text-foreground capitalize">
          {category?.name ?? tool.category}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">{tool.name}</span>
      </nav>

      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2 gap-1 pill">
        <Link href={`/category/${tool.category}`}>
          <ArrowLeft className="h-4 w-4" /> Back to {category?.name}
        </Link>
      </Button>

      {/* Header — glass panel with category accent */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 24 }}
        className="glass mb-8 flex items-start gap-4 rounded-[1.75rem] p-6"
        style={{ ["--cat-color" as string]: `var(--cat-${tool.category})` }}
      >
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-md"
          style={{ background: `var(--cat-${tool.category})` }}
        >
          <ToolIcon name={tool.icon} className="h-7 w-7" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{tool.name}</h1>
          <p className="mt-1 text-muted-foreground">{tool.description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="secondary" className="capitalize">
              {tool.processingType === "client" ? "Client-side" : "Server-side"}
            </Badge>
            {tool.popular && <Badge variant="outline">Popular</Badge>}
            {tool.featured && <Badge variant="outline">Featured</Badge>}
            {tool.premium && <Badge>Pro</Badge>}
            {tool.inputFormats && tool.inputFormats.length > 0 && (
              <Badge variant="outline" className="uppercase">
                {tool.inputFormats.map((m) => m.split("/").pop()).join(", ")}
              </Badge>
            )}
          </div>
        </div>
      </motion.div>

      {/* Tool body */}
      <div className="mb-10">{children}</div>

      {/* Info sections */}
      <div className="grid gap-6 md:grid-cols-3">
        <InfoCard title="How to use">
          <ol className="list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
            <li>{tool.processingType === "client" ? "Enter your data or upload a file." : "Upload your file (or drag & drop)."}</li>
            <li>Configure the options.</li>
            <li>Run the tool.</li>
            <li>Download or copy the result.</li>
          </ol>
        </InfoCard>
        <InfoCard title={tool.processingType === "client" ? "Privacy" : "Supported formats"}>
          {tool.processingType === "client" ? (
            <p className="text-sm text-muted-foreground">
              This tool runs entirely in your browser. No data is uploaded to a
              server.
            </p>
          ) : (
            <ul className="space-y-1 text-sm text-muted-foreground">
              {(tool.inputFormats ?? []).map((m) => (
                <li key={m} className="uppercase">{m.split("/").pop()}</li>
              ))}
              {(!tool.inputFormats || tool.inputFormats.length === 0) && (
                <li>No file upload required.</li>
              )}
            </ul>
          )}
        </InfoCard>
        <InfoCard title="Limitations">
          <p className="text-sm text-muted-foreground">
            {tool.processingType === "server"
              ? `Max file size: ${((tool.maxFileSize ?? 10485760) / 1048576).toFixed(0)} MB.`
              : "Subject to your device's memory and browser limits."}{" "}
            Outputs are validated before being marked complete.
          </p>
        </InfoCard>
      </div>

      {/* Related tools */}
      {related.length > 0 && (
        <div className="mt-12">
          <h2 className="mb-4 text-lg font-semibold">Related tools</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {related.map((t) => (
              <Link
                key={t.slug}
                href={`/tools/${t.slug}`}
                className="group flex flex-col items-center gap-2 rounded-2xl glass p-3 text-center transition spring hover:-translate-y-1 hover:shadow-md"
                style={{ ["--cat-color" as string]: `var(--cat-${tool.category})` }}
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-lg transition spring group-hover:scale-110"
                  style={{
                    background: `color-mix(in oklch, var(--cat-${tool.category}) 14%, transparent)`,
                    color: `var(--cat-${tool.category})`,
                  }}
                >
                  <ToolIcon name={t.icon} className="h-4 w-4" />
                </span>
                <span className="text-xs font-medium leading-tight line-clamp-2">{t.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-5">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}
