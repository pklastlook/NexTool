/**
 * NexTool — Central Tool Registry
 * Single source of truth for categories and tools.
 * The frontend reads capability info from here; do not duplicate definitions.
 */

import type { LucideIcon } from "lucide-react";
import {
  FileText, Image as ImageIcon, Film, FileArchive, FileType2, PenTool,
  Briefcase, ShoppingBag, Code2, Search, Share2, QrCode, Calculator, Sparkles,
} from "lucide-react";

export type ProcessingType = "client" | "server";

export interface ToolDef {
  slug: string;
  name: string;
  category: string; // category slug
  description: string;
  icon?: string; // lucide icon name (string; resolved on client)
  keywords: string[];
  seoTitle?: string;
  seoDescription?: string;
  inputFormats?: string[];
  outputFormats?: string[];
  processingType: ProcessingType;
  maxFileSize?: number; // bytes, for server tools
  premium?: boolean;
  featured?: boolean;
  popular?: boolean;
  version?: string;
}

export interface CategoryDef {
  slug: string;
  name: string;
  description: string;
  icon: string;
  order: number;
  accent: string; // tailwind-friendly accent token
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const CATEGORIES: CategoryDef[] = [
  { slug: "pdf", name: "PDF", description: "Merge, split, compress, convert and edit PDF files.", icon: "FileText", order: 1, accent: "rose" },
  { slug: "image", name: "Images", description: "Convert, compress, resize and edit images.", icon: "Image", order: 2, accent: "emerald" },
  { slug: "video-audio", name: "Video & Audio", description: "Compress, convert and extract from media files.", icon: "Film", order: 3, accent: "violet" },
  { slug: "office", name: "Microsoft Office", description: "Convert Word, Excel and PowerPoint files.", icon: "FileType2", order: 4, accent: "amber" },
  { slug: "documents", name: "Documents", description: "Generate invoices, quotes, receipts and letters.", icon: "FileArchive", order: 5, accent: "sky" },
  { slug: "business", name: "Business", description: "Calculators for profit, tax, loan and ROI.", icon: "Briefcase", order: 6, accent: "teal" },
  { slug: "ecommerce", name: "E-commerce", description: "Product profit, SKU and pricing utilities.", icon: "ShoppingBag", order: 7, accent: "orange" },
  { slug: "developer", name: "Developer", description: "JSON, Base64, JWT, hashes and encoders.", icon: "Code2", order: 8, accent: "cyan" },
  { slug: "seo", name: "SEO", description: "Meta tags, sitemaps, slugs and keyword tools.", icon: "Search", order: 9, accent: "lime" },
  { slug: "social", name: "Social Media", description: "Image resizers and caption utilities.", icon: "Share2", order: 10, accent: "pink" },
  { slug: "qr-barcode", name: "QR & Barcode", description: "Generate QR codes and barcodes.", icon: "QrCode", order: 11, accent: "fuchsia" },
  { slug: "text", name: "Text", description: "Count, transform, clean and diff text.", icon: "PenTool", order: 12, accent: "indigo" },
  { slug: "calculators", name: "Calculators", description: "Everyday math and unit converters.", icon: "Calculator", order: 13, accent: "blue" },
];

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export const TOOLS: ToolDef[] = [
  // ---- PDF (server) ----
  { slug: "merge-pdf", name: "Merge PDF", category: "pdf", description: "Combine multiple PDFs into one document.", icon: "Combine", keywords: ["join","combine","pdf","merge"], inputFormats: ["application/pdf"], outputFormats: ["application/pdf"], processingType: "server", maxFileSize: 104857600, popular: true, featured: true },
  { slug: "split-pdf", name: "Split PDF", category: "pdf", description: "Extract a page range or split each page into a separate PDF.", icon: "Scissors", keywords: ["split","extract","pages","pdf"], inputFormats: ["application/pdf"], outputFormats: ["application/pdf"], processingType: "server", maxFileSize: 104857600, popular: true },
  { slug: "compress-pdf", name: "Compress PDF", category: "pdf", description: "Reduce PDF file size with Ghostscript.", icon: "Minimize2", keywords: ["compress","reduce","optimize","pdf"], inputFormats: ["application/pdf"], outputFormats: ["application/pdf"], processingType: "server", maxFileSize: 104857600, popular: true, featured: true },
  { slug: "rotate-pdf", name: "Rotate PDF", category: "pdf", description: "Rotate all or selected pages of a PDF.", icon: "RotateCw", keywords: ["rotate","turn","pdf","orientation"], inputFormats: ["application/pdf"], outputFormats: ["application/pdf"], processingType: "server", maxFileSize: 104857600 },
  { slug: "pdf-to-text", name: "PDF to Text", category: "pdf", description: "Extract selectable text from a PDF.", icon: "FileText", keywords: ["extract","text","pdf","txt"], inputFormats: ["application/pdf"], outputFormats: ["text/plain"], processingType: "server", maxFileSize: 104857600 },
  { slug: "pdf-to-images", name: "PDF to Images", category: "pdf", description: "Render each PDF page as a PNG image.", icon: "Image", keywords: ["pdf","jpg","png","images","convert"], inputFormats: ["application/pdf"], outputFormats: ["image/png"], processingType: "server", maxFileSize: 104857600 },

  // ---- Image (server, Sharp) ----
  { slug: "image-converter", name: "Image Converter", category: "image", description: "Convert between JPG, PNG, WebP, AVIF and more.", icon: "RefreshCw", keywords: ["convert","jpg","png","webp","avif"], inputFormats: ["image/jpeg","image/png","image/webp","image/avif","image/gif","image/tiff"], outputFormats: ["image/jpeg","image/png","image/webp","image/avif"], processingType: "server", maxFileSize: 52428800, popular: true, featured: true },
  { slug: "image-compressor", name: "Image Compressor", category: "image", description: "Compress JPG, PNG and WebP with adjustable quality.", icon: "Minimize2", keywords: ["compress","reduce","optimize","image"], inputFormats: ["image/jpeg","image/png","image/webp"], outputFormats: ["image/jpeg","image/png","image/webp"], processingType: "server", maxFileSize: 52428800, popular: true, featured: true },
  { slug: "image-resizer", name: "Image Resizer", category: "image", description: "Resize images to exact dimensions or by percentage.", icon: "Scaling", keywords: ["resize","scale","dimensions","image"], inputFormats: ["image/jpeg","image/png","image/webp","image/avif"], outputFormats: ["image/jpeg","image/png","image/webp"], processingType: "server", maxFileSize: 52428800 },
  { slug: "image-cropper", name: "Image Cropper", category: "image", description: "Crop images to a custom region.", icon: "Crop", keywords: ["crop","cut","image"], inputFormats: ["image/jpeg","image/png","image/webp"], outputFormats: ["image/png","image/jpeg"], processingType: "server", maxFileSize: 52428800 },
  { slug: "remove-exif", name: "Remove EXIF Metadata", category: "image", description: "Strip EXIF/metadata from images for privacy.", icon: "ShieldCheck", keywords: ["exif","metadata","privacy","strip","image"], inputFormats: ["image/jpeg","image/png","image/webp"], outputFormats: ["image/jpeg","image/png","image/webp"], processingType: "server", maxFileSize: 52428800 },

  // ---- Video & Audio (server, FFmpeg) ----
  { slug: "video-compressor", name: "Video Compressor", category: "video-audio", description: "Compress video files with FFmpeg.", icon: "Film", keywords: ["compress","video","mp4","reduce"], inputFormats: ["video/mp4","video/quicktime","video/x-matroska"], outputFormats: ["video/mp4"], processingType: "server", maxFileSize: 524288000 },
  { slug: "video-converter", name: "Video Converter", category: "video-audio", description: "Convert video between MP4, WebM and MOV.", icon: "RefreshCw", keywords: ["convert","video","mp4","webm","mov"], inputFormats: ["video/mp4","video/quicktime","video/x-matroska","video/webm"], outputFormats: ["video/mp4","video/webm"], processingType: "server", maxFileSize: 524288000 },
  { slug: "video-to-gif", name: "Video to GIF", category: "video-audio", description: "Convert a video clip to an animated GIF.", icon: "Image", keywords: ["video","gif","convert","animated"], inputFormats: ["video/mp4","video/quicktime","video/x-matroska"], outputFormats: ["image/gif"], processingType: "server", maxFileSize: 524288000 },
  { slug: "audio-extractor", name: "Audio Extractor", category: "video-audio", description: "Extract the audio track from a video as MP3.", icon: "Music", keywords: ["audio","extract","mp3","video"], inputFormats: ["video/mp4","video/quicktime","video/x-matroska","video/webm"], outputFormats: ["audio/mpeg"], processingType: "server", maxFileSize: 524288000 },
  { slug: "audio-converter", name: "Audio Converter", category: "video-audio", description: "Convert between MP3, WAV and AAC.", icon: "Music", keywords: ["audio","convert","mp3","wav","aac"], inputFormats: ["audio/mpeg","audio/wav","audio/aac","audio/x-m4a"], outputFormats: ["audio/mpeg","audio/wav","audio/aac"], processingType: "server", maxFileSize: 104857600 },

  // ---- Office (server, LibreOffice) ----
  { slug: "word-to-pdf", name: "Word to PDF", category: "office", description: "Convert DOCX and DOC to PDF with LibreOffice.", icon: "FileType2", keywords: ["word","docx","doc","pdf","convert"], inputFormats: ["application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"], outputFormats: ["application/pdf"], processingType: "server", maxFileSize: 104857600, popular: true, featured: true },
  { slug: "excel-to-pdf", name: "Excel to PDF", category: "office", description: "Convert XLSX and XLS to PDF.", icon: "Sheet", keywords: ["excel","xlsx","xls","pdf","convert"], inputFormats: ["application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], outputFormats: ["application/pdf"], processingType: "server", maxFileSize: 104857600, popular: true },
  { slug: "powerpoint-to-pdf", name: "PowerPoint to PDF", category: "office", description: "Convert PPTX and PPT to PDF.", icon: "Presentation", keywords: ["powerpoint","pptx","ppt","pdf","convert"], inputFormats: ["application/vnd.ms-powerpoint","application/vnd.openxmlformats-officedocument.presentationml.presentation"], outputFormats: ["application/pdf"], processingType: "server", maxFileSize: 104857600 },
  { slug: "xlsx-to-csv", name: "Excel to CSV", category: "office", description: "Convert XLSX sheets to CSV.", icon: "Sheet", keywords: ["excel","xlsx","csv","convert"], inputFormats: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/vnd.ms-excel"], outputFormats: ["text/csv"], processingType: "server", maxFileSize: 104857600 },
  { slug: "csv-to-xlsx", name: "CSV to Excel", category: "office", description: "Convert CSV data into an XLSX workbook.", icon: "Sheet", keywords: ["csv","xlsx","excel","convert"], inputFormats: ["text/csv"], outputFormats: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], processingType: "server", maxFileSize: 10485760 },

  // ---- OCR (server, Tesseract) ----
  { slug: "image-to-text", name: "Image to Text (OCR)", category: "image", description: "Extract text from images using Tesseract OCR.", icon: "ScanText", keywords: ["ocr","text","extract","image","tesseract"], inputFormats: ["image/png","image/jpeg","image/webp","image/tiff"], outputFormats: ["text/plain"], processingType: "server", maxFileSize: 26214400, featured: true },

  // ---- Documents (server, generators) ----
  { slug: "invoice-generator", name: "Invoice Generator", category: "documents", description: "Create a professional PDF invoice from your data.", icon: "ReceiptText", keywords: ["invoice","pdf","generator","business"], processingType: "server", popular: true, featured: true },
  { slug: "quotation-generator", name: "Quotation Generator", category: "documents", description: "Generate a PDF quotation for your customers.", icon: "FileText", keywords: ["quote","quotation","pdf","generator"], processingType: "server" },
  { slug: "receipt-generator", name: "Receipt Generator", category: "documents", description: "Generate a PDF payment receipt.", icon: "Receipt", keywords: ["receipt","pdf","payment","generator"], processingType: "server" },

  // ---- Business calculators (client) ----
  { slug: "percentage-calculator", name: "Percentage Calculator", category: "business", description: "Calculate percentages, increases and decreases.", icon: "Percent", keywords: ["percentage","percent","calculator"], processingType: "client", popular: true },
  { slug: "profit-margin-calculator", name: "Profit Margin Calculator", category: "business", description: "Calculate profit margin, markup and net profit.", icon: "TrendingUp", keywords: ["profit","margin","markup","calculator"], processingType: "client", popular: true },
  { slug: "discount-calculator", name: "Discount Calculator", category: "business", description: "Calculate discounted price and savings.", icon: "BadgePercent", keywords: ["discount","sale","price","calculator"], processingType: "client" },
  { slug: "vat-calculator", name: "VAT Calculator", category: "business", description: "Add or remove VAT from a price.", icon: "ReceiptText", keywords: ["vat","tax","calculator"], processingType: "client" },
  { slug: "gst-calculator", name: "GST Calculator", category: "business", description: "Calculate GST inclusive and exclusive amounts.", icon: "ReceiptText", keywords: ["gst","tax","calculator"], processingType: "client" },
  { slug: "loan-calculator", name: "Loan Calculator", category: "business", description: "Calculate loan payments and total interest.", icon: "Landmark", keywords: ["loan","interest","calculator","emi"], processingType: "client" },
  { slug: "emi-calculator", name: "EMI Calculator", category: "business", description: "Calculate monthly EMI for a loan.", icon: "CalendarClock", keywords: ["emi","loan","monthly","calculator"], processingType: "client" },
  { slug: "roi-calculator", name: "ROI Calculator", category: "business", description: "Calculate return on investment.", icon: "TrendingUp", keywords: ["roi","return","investment","calculator"], processingType: "client" },
  { slug: "currency-converter", name: "Currency Converter", category: "business", description: "Convert between common currencies using stored rates.", icon: "DollarSign", keywords: ["currency","convert","exchange"], processingType: "client" },

  // ---- E-commerce (client) ----
  { slug: "product-profit-calculator", name: "Product Profit Calculator", category: "ecommerce", description: "Calculate net profit including fees and shipping.", icon: "ShoppingCart", keywords: ["product","profit","ecommerce","fees"], processingType: "client", featured: true },
  { slug: "sku-generator", name: "SKU Generator", category: "ecommerce", description: "Generate SKUs from product names and variants.", icon: "Tag", keywords: ["sku","product","code","generate"], processingType: "client" },

  // ---- Developer tools (client) ----
  { slug: "json-formatter", name: "JSON Formatter", category: "developer", description: "Format, validate and beautify JSON.", icon: "Braces", keywords: ["json","format","beautify","validate"], processingType: "client", popular: true, featured: true },
  { slug: "json-minifier", name: "JSON Minifier", category: "developer", description: "Minify JSON to the smallest valid size.", icon: "Minimize2", keywords: ["json","minify","compress"], processingType: "client" },
  { slug: "json-to-csv", name: "JSON to CSV", category: "developer", description: "Convert a JSON array of objects to CSV.", icon: "Sheet", keywords: ["json","csv","convert"], processingType: "client" },
  { slug: "csv-to-json", name: "CSV to JSON", category: "developer", description: "Convert CSV data to a JSON array.", icon: "Braces", keywords: ["csv","json","convert"], processingType: "client" },
  { slug: "base64-encoder", name: "Base64 Encode / Decode", category: "developer", description: "Encode text to Base64 or decode it back.", icon: "Binary", keywords: ["base64","encode","decode"], processingType: "client", popular: true },
  { slug: "url-encoder", name: "URL Encode / Decode", category: "developer", description: "Percent-encode or decode URLs.", icon: "Link", keywords: ["url","encode","decode","percent"], processingType: "client" },
  { slug: "html-encoder", name: "HTML Encode / Decode", category: "developer", description: "Escape or unescape HTML entities.", icon: "Code2", keywords: ["html","encode","decode","escape","entities"], processingType: "client" },
  { slug: "jwt-decoder", name: "JWT Decoder", category: "developer", description: "Decode the header and payload of a JWT.", icon: "KeyRound", keywords: ["jwt","token","decode","json"], processingType: "client" },
  { slug: "uuid-generator", name: "UUID Generator", category: "developer", description: "Generate v4 and v7 UUIDs.", icon: "Fingerprint", keywords: ["uuid","guid","generate","v4","v7"], processingType: "client" },
  { slug: "hash-generator", name: "Hash Generator", category: "developer", description: "Generate SHA-1, SHA-256, SHA-384 and SHA-512 hashes.", icon: "Hash", keywords: ["hash","sha256","sha1","sha512","digest"], processingType: "client" },
  { slug: "color-converter", name: "HEX ↔ RGB Converter", category: "developer", description: "Convert between HEX, RGB and HSL color formats.", icon: "Palette", keywords: ["color","hex","rgb","hsl","convert"], processingType: "client" },
  { slug: "markdown-to-html", name: "Markdown to HTML", category: "developer", description: "Render Markdown into clean HTML.", icon: "FileCode", keywords: ["markdown","md","html","convert"], processingType: "client" },
  { slug: "html-to-markdown", name: "HTML to Markdown", category: "developer", description: "Convert HTML back into Markdown.", icon: "FileCode", keywords: ["html","markdown","convert","turndown"], processingType: "client" },
  { slug: "unix-timestamp-converter", name: "Unix Timestamp Converter", category: "developer", description: "Convert between Unix timestamps and human dates.", icon: "Clock", keywords: ["unix","timestamp","date","epoch"], processingType: "client" },
  { slug: "regex-tester", name: "Regex Tester", category: "developer", description: "Test JavaScript regular expressions with live matches.", icon: "Regex", keywords: ["regex","regexp","test","match"], processingType: "client" },
  { slug: "yaml-json-converter", name: "YAML ↔ JSON Converter", category: "developer", description: "Convert between YAML and JSON.", icon: "Braces", keywords: ["yaml","json","convert"], processingType: "client" },
  { slug: "xml-json-converter", name: "XML ↔ JSON Converter", category: "developer", description: "Convert between XML and JSON.", icon: "Code2", keywords: ["xml","json","convert"], processingType: "client" },

  // ---- SEO tools (client) ----
  { slug: "meta-tag-generator", name: "Meta Tag Generator", category: "seo", description: "Generate SEO meta and Open Graph tags.", icon: "Tags", keywords: ["meta","tags","seo","og"], processingType: "client", popular: true },
  { slug: "utm-builder", name: "UTM Builder", category: "seo", description: "Build UTM tracking URLs for campaigns.", icon: "Link", keywords: ["utm","url","tracking","campaign"], processingType: "client", popular: true },
  { slug: "slug-generator", name: "SEO Slug Generator", category: "seo", description: "Create URL-friendly slugs from titles.", icon: "Link2", keywords: ["slug","url","seo","permalink"], processingType: "client" },
  { slug: "keyword-density", name: "Keyword Density Checker", category: "seo", description: "Analyze keyword frequency and density in text.", icon: "Search", keywords: ["keyword","density","seo","text"], processingType: "client" },
  { slug: "robots-txt-generator", name: "Robots.txt Generator", category: "seo", description: "Generate a robots.txt for your site.", icon: "Bot", keywords: ["robots","txt","seo","crawler"], processingType: "client" },

  // ---- Social Media (client) ----
  { slug: "instagram-image-resizer", name: "Instagram Image Resizer", category: "social", description: "Resize images for Instagram post, story and square.", icon: "Instagram", keywords: ["instagram","resize","image","social"], processingType: "client" },
  { slug: "youtube-thumbnail-maker", name: "YouTube Thumbnail Maker", category: "social", description: "Resize images to 1280×720 YouTube thumbnails.", icon: "Youtube", keywords: ["youtube","thumbnail","resize","social"], processingType: "client" },
  { slug: "hashtag-generator", name: "Hashtag Generator", category: "social", description: "Generate hashtags from a keyword or topic.", icon: "Hash", keywords: ["hashtag","social","instagram","tags"], processingType: "client" },

  // ---- QR & Barcode (client) ----
  { slug: "qr-generator", name: "QR Code Generator", category: "qr-barcode", description: "Generate QR codes for URL, text, email, WiFi and vCard.", icon: "QrCode", keywords: ["qr","code","generate","url","wifi"], processingType: "client", popular: true, featured: true },
  { slug: "barcode-generator", name: "Barcode Generator", category: "qr-barcode", description: "Generate CODE128, EAN13, UPC and other barcodes.", icon: "Barcode", keywords: ["barcode","code128","ean13","upc"], processingType: "client" },

  // ---- Text tools (client) ----
  { slug: "word-counter", name: "Word Counter", category: "text", description: "Count words, characters, sentences and reading time.", icon: "Type", keywords: ["word","count","character","text"], processingType: "client", popular: true },
  { slug: "case-converter", name: "Case Converter", category: "text", description: "Convert text to UPPER, lower, Title or Sentence case.", icon: "ALargeSmall", keywords: ["case","upper","lower","title","text"], processingType: "client" },
  { slug: "remove-duplicate-lines", name: "Remove Duplicate Lines", category: "text", description: "Remove duplicate lines from a list.", icon: "Eraser", keywords: ["duplicate","lines","remove","unique"], processingType: "client" },
  { slug: "text-diff", name: "Text Diff", category: "text", description: "Compare two blocks of text and highlight differences.", icon: "GitCompare", keywords: ["diff","compare","text"], processingType: "client" },
  { slug: "lorem-ipsum-generator", name: "Lorem Ipsum Generator", category: "text", description: "Generate placeholder Lorem Ipsum text.", icon: "AlignLeft", keywords: ["lorem","ipsum","placeholder","text"], processingType: "client" },

  // ---- Calculators (client) ----
  { slug: "age-calculator", name: "Age Calculator", category: "calculators", description: "Calculate exact age in years, months and days.", icon: "Cake", keywords: ["age","birthday","calculator","date"], processingType: "client" },
  { slug: "bmi-calculator", name: "BMI Calculator", category: "calculators", description: "Calculate Body Mass Index and category.", icon: "HeartPulse", keywords: ["bmi","health","calculator","weight"], processingType: "client" },
  { slug: "tip-calculator", name: "Tip Calculator", category: "calculators", description: "Split a bill and calculate the tip.", icon: "ReceiptText", keywords: ["tip","bill","split","calculator"], processingType: "client" },
  { slug: "unit-converter", name: "Unit Converter", category: "calculators", description: "Convert length, weight, temperature, speed and data.", icon: "Ruler", keywords: ["unit","convert","length","weight","temperature"], processingType: "client", popular: true },
  { slug: "time-zone-converter", name: "Time Zone Converter", category: "calculators", description: "Convert times between world time zones.", icon: "Globe", keywords: ["time","zone","convert","world"], processingType: "client" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getCategory(slug: string): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function getTool(slug: string): ToolDef | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

export function toolsByCategory(categorySlug: string): ToolDef[] {
  return TOOLS.filter((t) => t.category === categorySlug);
}

export function popularTools(limit = 8): ToolDef[] {
  return TOOLS.filter((t) => t.popular).slice(0, limit);
}

export function featuredTools(limit = 6): ToolDef[] {
  return TOOLS.filter((t) => t.featured).slice(0, limit);
}

export function searchTools(query: string): ToolDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return TOOLS.filter((t) => {
    const hay = [t.name, t.description, ...t.keywords, t.category].join(" ").toLowerCase();
    return hay.includes(q);
  });
}

// Resolved icon map (string name -> component) — used by the UI layer.
// Importing this map keeps the registry as the single source of truth.
export const ICON_MAP: Record<string, LucideIcon> = {
  FileText, Image: ImageIcon, Film, FileArchive, FileType2, PenTool,
  Briefcase, ShoppingBag, Code2, Search, Share2, QrCode, Calculator, Sparkles,
};
