import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTool, TOOLS, getCategory } from "@/lib/tool-registry";
import { ToolPageLayout } from "@/components/tools/tool-page-layout";
import { ToolRenderer } from "@/components/tools/tool-renderer";

export const dynamicParams = false;

// Pre-render every registered tool page (SSG) — great for SEO.
export function generateStaticParams() {
  return TOOLS.map((t) => ({ slug: t.slug }));
}

export function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return params.then((p) => {
    const tool = getTool(p.slug);
    const cat = tool ? getCategory(tool.category) : undefined;
    if (!tool) return { title: "Tool not found" };
    return {
      title: tool.seoTitle ?? tool.name,
      description: tool.seoDescription ?? tool.description,
      keywords: tool.keywords,
      openGraph: {
        title: tool.seoTitle ?? tool.name,
        description: tool.seoDescription ?? tool.description,
        type: "website",
      },
      alternates: { canonical: `/tools/${tool.slug}` },
    };
  });
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) notFound();

  return (
    <ToolPageLayout tool={tool}>
      <ToolRenderer tool={tool} />
    </ToolPageLayout>
  );
}
