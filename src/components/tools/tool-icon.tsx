'use client'

import {
  FileText, Image as ImageIcon, Film, FileArchive, FileType2, PenTool,
  Briefcase, ShoppingBag, Code2, Search, Share2, QrCode, Calculator, Sparkles,
  Combine, Scissors, Minimize2, RotateCw, RefreshCw, Scaling, Crop, ShieldCheck,
  Music, Sheet, Presentation, ReceiptText, Receipt, Percent, TrendingUp,
  BadgePercent, Landmark, CalendarClock, DollarSign, ShoppingCart, Tag, Braces,
  Binary, Link, KeyRound, Fingerprint, Hash, Palette, FileCode, Clock, Regex,
  Tags, Link2, Bot, Instagram, Youtube, Type, ALargeSmall, Eraser, GitCompare,
  AlignLeft, Cake, HeartPulse, Ruler, Globe, Home, LayoutGrid, Activity,
  ScanText, Barcode, Music2,
  type LucideProps,
} from "lucide-react";

const MAP: Record<string, React.ComponentType<LucideProps>> = {
  FileText, Image: ImageIcon, Film, FileArchive, FileType2, PenTool,
  Briefcase, ShoppingBag, Code2, Search, Share2, QrCode, Calculator, Sparkles,
  Combine, Scissors, Minimize2, RotateCw, RefreshCw, Scaling, Crop, ShieldCheck,
  Music, Music2, Sheet, Presentation, ReceiptText, Receipt, Percent, TrendingUp,
  BadgePercent, Landmark, CalendarClock, DollarSign, ShoppingCart, Tag, Braces,
  Binary, Link, KeyRound, Fingerprint, Hash, Palette, FileCode, Clock, Regex,
  Tags, Link2, Bot, Instagram, Youtube, Type, ALargeSmall, Eraser, GitCompare,
  AlignLeft, Cake, HeartPulse, Ruler, Globe, Home, LayoutGrid, Activity,
  ScanText, Barcode,
};

export function ToolIcon({ name, className, ...props }: { name?: string; className?: string } & LucideProps) {
  const Comp = (name && MAP[name]) || FileText;
  return <Comp className={className} {...props} />;
}
