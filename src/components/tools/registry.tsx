'use client'

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

/**
 * Tool component registry.
 * Maps a tool slug -> lazily-loaded client component.
 * Each component receives no props (it fetches its tool def from the slug
 * via the page) and renders inside the ToolPageLayout.
 *
 * To add a new tool UI, create src/components/tools/impl/<slug>.tsx
 * and add an entry here.
 */

const Loading = () => (
  <div className="flex items-center gap-2 text-muted-foreground">
    <Loader2 className="h-4 w-4 animate-spin" /> Loading tool…
  </div>
);

const d = (loader: () => Promise<{ default: React.ComponentType }>) =>
  dynamic(loader, { loading: () => <Loading /> });

export const TOOL_COMPONENTS: Record<string, React.ComponentType> = {
  // Developer
  "json-formatter": d(() => import("@/components/tools/impl/json-formatter")),
  "json-minifier": d(() => import("@/components/tools/impl/json-minifier")),
  "json-to-csv": d(() => import("@/components/tools/impl/json-to-csv")),
  "csv-to-json": d(() => import("@/components/tools/impl/csv-to-json")),
  "base64-encoder": d(() => import("@/components/tools/impl/base64-encoder")),
  "url-encoder": d(() => import("@/components/tools/impl/url-encoder")),
  "html-encoder": d(() => import("@/components/tools/impl/html-encoder")),
  "jwt-decoder": d(() => import("@/components/tools/impl/jwt-decoder")),
  "uuid-generator": d(() => import("@/components/tools/impl/uuid-generator")),
  "hash-generator": d(() => import("@/components/tools/impl/hash-generator")),
  "color-converter": d(() => import("@/components/tools/impl/color-converter")),
  "markdown-to-html": d(() => import("@/components/tools/impl/markdown-to-html")),
  "html-to-markdown": d(() => import("@/components/tools/impl/html-to-markdown")),
  "unix-timestamp-converter": d(() => import("@/components/tools/impl/unix-timestamp-converter")),
  "regex-tester": d(() => import("@/components/tools/impl/regex-tester")),
  "yaml-json-converter": d(() => import("@/components/tools/impl/yaml-json-converter")),
  "xml-json-converter": d(() => import("@/components/tools/impl/xml-json-converter")),

  // Text
  "word-counter": d(() => import("@/components/tools/impl/word-counter")),
  "case-converter": d(() => import("@/components/tools/impl/case-converter")),
  "remove-duplicate-lines": d(() => import("@/components/tools/impl/remove-duplicate-lines")),
  "text-diff": d(() => import("@/components/tools/impl/text-diff")),
  "lorem-ipsum-generator": d(() => import("@/components/tools/impl/lorem-ipsum-generator")),

  // Calculators / Business
  "percentage-calculator": d(() => import("@/components/tools/impl/percentage-calculator")),
  "profit-margin-calculator": d(() => import("@/components/tools/impl/profit-margin-calculator")),
  "discount-calculator": d(() => import("@/components/tools/impl/discount-calculator")),
  "vat-calculator": d(() => import("@/components/tools/impl/vat-calculator")),
  "gst-calculator": d(() => import("@/components/tools/impl/gst-calculator")),
  "loan-calculator": d(() => import("@/components/tools/impl/loan-calculator")),
  "emi-calculator": d(() => import("@/components/tools/impl/emi-calculator")),
  "roi-calculator": d(() => import("@/components/tools/impl/roi-calculator")),
  "currency-converter": d(() => import("@/components/tools/impl/currency-converter")),
  "age-calculator": d(() => import("@/components/tools/impl/age-calculator")),
  "bmi-calculator": d(() => import("@/components/tools/impl/bmi-calculator")),
  "tip-calculator": d(() => import("@/components/tools/impl/tip-calculator")),
  "unit-converter": d(() => import("@/components/tools/impl/unit-converter")),
  "time-zone-converter": d(() => import("@/components/tools/impl/time-zone-converter")),

  // E-commerce
  "product-profit-calculator": d(() => import("@/components/tools/impl/product-profit-calculator")),
  "sku-generator": d(() => import("@/components/tools/impl/sku-generator")),

  // SEO
  "meta-tag-generator": d(() => import("@/components/tools/impl/meta-tag-generator")),
  "utm-builder": d(() => import("@/components/tools/impl/utm-builder")),
  "slug-generator": d(() => import("@/components/tools/impl/slug-generator")),
  "keyword-density": d(() => import("@/components/tools/impl/keyword-density")),
  "robots-txt-generator": d(() => import("@/components/tools/impl/robots-txt-generator")),

  // Social
  "instagram-image-resizer": d(() => import("@/components/tools/impl/instagram-image-resizer")),
  "youtube-thumbnail-maker": d(() => import("@/components/tools/impl/youtube-thumbnail-maker")),
  "hashtag-generator": d(() => import("@/components/tools/impl/hashtag-generator")),

  // QR & Barcode
  "qr-generator": d(() => import("@/components/tools/impl/qr-generator")),
  "barcode-generator": d(() => import("@/components/tools/impl/barcode-generator")),

  // Documents (server, custom UI)
  "invoice-generator": d(() => import("@/components/tools/impl/invoice-generator")),
};

export function hasToolComponent(slug: string): boolean {
  return slug in TOOL_COMPONENTS;
}
