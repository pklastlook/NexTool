/**
 * Seed categories + tools from the registry into the database.
 * Idempotent: re-running upserts by slug.
 */
import { PrismaClient } from "@prisma/client";
import { CATEGORIES, TOOLS } from "../src/lib/tool-registry";

const db = new PrismaClient();

async function main() {
  // Categories
  for (const c of CATEGORIES) {
    await db.category.upsert({
      where: { slug: c.slug },
      create: {
        slug: c.slug,
        name: c.name,
        description: c.description,
        icon: c.icon,
        order: c.order,
      },
      update: {
        name: c.name,
        description: c.description,
        icon: c.icon,
        order: c.order,
      },
    });
  }
  console.log(`✓ Seeded ${CATEGORIES.length} categories`);

  // Tools + usage counters
  let usageCount = 0;
  for (const t of TOOLS) {
    const category = await db.category.findUnique({ where: { slug: t.category } });
    if (!category) {
      console.warn(`  ! category not found for tool ${t.slug} (${t.category})`);
      continue;
    }
    const tool = await db.tool.upsert({
      where: { slug: t.slug },
      create: {
        slug: t.slug,
        name: t.name,
        categoryId: category.id,
        description: t.description,
        icon: t.icon ?? null,
        keywords: t.keywords.join("|"),
        seoTitle: t.seoTitle ?? null,
        seoDescription: t.seoDescription ?? null,
        inputFormats: t.inputFormats?.join("|") ?? null,
        outputFormats: t.outputFormats?.join("|") ?? null,
        processingType: t.processingType,
        maxFileSize: t.maxFileSize ?? 10485760,
        premium: t.premium ?? false,
        featured: t.featured ?? false,
        popular: t.popular ?? false,
        active: true,
        version: t.version ?? "1.0.0",
      },
      update: {
        name: t.name,
        categoryId: category.id,
        description: t.description,
        icon: t.icon ?? null,
        keywords: t.keywords.join("|"),
        inputFormats: t.inputFormats?.join("|") ?? null,
        outputFormats: t.outputFormats?.join("|") ?? null,
        processingType: t.processingType,
        maxFileSize: t.maxFileSize ?? 10485760,
        premium: t.premium ?? false,
        featured: t.featured ?? false,
        popular: t.popular ?? false,
      },
    });

    await db.toolUsage.upsert({
      where: { toolId: tool.id },
      create: { toolId: tool.id, totalRuns: 0, successRuns: 0, failedRuns: 0 },
      update: {},
    });
    usageCount++;
  }
  console.log(`✓ Seeded ${TOOLS.length} tools (+ ${usageCount} usage rows)`);

  const counts = {
    categories: await db.category.count(),
    tools: await db.tool.count(),
  };
  console.log("DB counts:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
