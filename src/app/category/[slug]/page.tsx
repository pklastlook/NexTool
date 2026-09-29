import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { CATEGORIES, getCategory, toolsByCategory, TOOLS } from "@/lib/tool-registry";
import { ToolIcon } from "@/components/tools/tool-icon";

export const dynamicParams = false;

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }));
}

export function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return params.then((p) => {
    const c = getCategory(p.slug);
    if (!c) return { title: "Category not found" };
    return {
      title: `${c.name} tools`,
      description: c.description,
    };
  });
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) notFound();

  const tools = toolsByCategory(slug);
  const featured = tools.filter((t) => t.featured);
  const popular = tools.filter((t) => t.popular);
  const relatedCats = CATEGORIES.filter((c) => c.slug !== slug).slice(0, 6);

  return (
    <div className="px-1 py-6 sm:py-8">
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span className="mx-1">/</span>
        <span className="text-foreground">{category.name}</span>
      </nav>

      {/* Hero header — glass panel with category accent */}
      <div
        className="glass mb-8 rounded-[2rem] p-6 sm:p-8"
        style={{ ["--cat-color" as string]: `var(--cat-${category.slug})` }}
      >
        <div className="flex items-start gap-4">
          <span
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white shadow-md"
            style={{ background: `var(--cat-${category.slug})` }}
          >
            <ToolIcon name={category.icon} className="h-8 w-8" />
          </span>
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{category.name}</h1>
            <p className="mt-1 text-muted-foreground">{category.description}</p>
            <div className="mt-3">
              <span
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{
                  background: `color-mix(in oklch, var(--cat-${category.slug}) 12%, transparent)`,
                  color: `var(--cat-${category.slug})`,
                }}
              >
                {tools.length} tools
              </span>
            </div>
          </div>
        </div>
      </div>

      {popular.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold">Popular in {category.name}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {popular.map((t) => (
              <ToolCard key={t.slug} tool={t} categorySlug={category.slug} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-4 text-lg font-semibold">All {category.name} tools</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tools.map((t) => (
            <ToolCard key={t.slug} tool={t} categorySlug={category.slug} />
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="mb-4 text-lg font-semibold">Other categories</h2>
        <div className="flex flex-wrap gap-2">
          {relatedCats.map((c) => (
            <Link
              key={c.slug}
              href={`/category/${c.slug}`}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm hover:bg-accent"
            >
              <ToolIcon name={c.icon} className="h-4 w-4" />
              {c.name}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function ToolCard({ tool, categorySlug }: { tool: (typeof TOOLS)[number]; categorySlug: string }) {
  return (
    <Link
      href={`/tools/${tool.slug}`}
      className="group flex h-full flex-col gap-3 rounded-2xl glass p-5 transition spring hover:-translate-y-1 hover:shadow-lg"
      style={{ ["--cat-color" as string]: `var(--cat-${categorySlug})` }}
    >
      <span
        className="flex h-11 w-11 items-center justify-center rounded-xl transition spring group-hover:scale-110"
        style={{
          background: `color-mix(in oklch, var(--cat-${categorySlug}) 14%, transparent)`,
          color: `var(--cat-${categorySlug})`,
        }}
      >
        <ToolIcon name={tool.icon} className="h-5 w-5" />
      </span>
      <div className="flex-1">
        <h3 className="font-semibold leading-tight">{tool.name}</h3>
        <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{tool.description}</p>
      </div>
    </Link>
  );
}
