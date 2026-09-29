import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { AppShell } from "@/components/layout/app-shell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "NexTool — Powerful tools for everyday work",
    template: "%s · NexTool",
  },
  description:
    "Convert, compress, create, calculate and simplify — all in one premium platform. PDF, images, video, Office, OCR, QR, calculators and developer tools that actually work.",
  keywords: [
    "online tools", "PDF tools", "image converter", "file converter",
    "compress PDF", "QR generator", "JSON formatter", "OCR", "calculator",
  ],
  authors: [{ name: "NexTool" }],
  icons: { icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg" },
  openGraph: {
    title: "NexTool — Powerful tools for everyday work",
    description: "A premium all-in-one online tools platform. Every tool actually works.",
    siteName: "NexTool",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AppShell>{children}</AppShell>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
