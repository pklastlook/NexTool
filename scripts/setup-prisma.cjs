#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Prisma provider selector.
 *
 * Prisma doesn't allow `provider = env(...)`, so we keep two schema files:
 *   - prisma/schema.prisma          (SQLite — sandbox / local dev)
 *   - prisma/schema.postgres.prisma  (PostgreSQL — Vercel / Neon)
 *
 * This script reads DATABASE_URL and copies the right variant into place
 * before `prisma generate` / `prisma db push`. It's wired into the
 * `db:push`, `db:generate`, and `postinstall` npm scripts.
 *
 * On Vercel: set DATABASE_URL to your Neon connection string
 *            (postgres://... or postgresql://...). This script auto-selects
 *            the PostgreSQL schema at build time.
 *
 * On the sandbox / local: DATABASE_URL=file:... → SQLite is used.
 */
const fs = require("node:fs");
const path = require("node:path");

const SCHEMA = path.join(process.cwd(), "prisma", "schema.prisma");
const POSTGRES_VARIANT = path.join(process.cwd(), "prisma", "schema.postgres.prisma");

const dbUrl = process.env.DATABASE_URL || "";
const isPostgres = dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://");

if (isPostgres) {
  if (!fs.existsSync(POSTGRES_VARIANT)) {
    console.error("[setup-prisma] DATABASE_URL is PostgreSQL but prisma/schema.postgres.prisma not found.");
    process.exit(1);
  }
  fs.copyFileSync(POSTGRES_VARIANT, SCHEMA);
  console.log("[setup-prisma] Selected PostgreSQL schema (DATABASE_URL starts with postgres://).");
} else {
  // Ensure schema.prisma uses sqlite — if someone swapped it manually, restore.
  const current = fs.readFileSync(SCHEMA, "utf-8");
  if (current.includes('provider = "postgresql"')) {
    // Need the sqlite variant. Since we keep the sqlite content as the
    // canonical "default", we restore from git would be ideal, but for
    // simplicity we just rewrite the provider line.
    fs.writeFileSync(SCHEMA, current.replace('provider = "postgresql"', 'provider = "sqlite"'));
    console.log("[setup-prisma] Restored SQLite provider (DATABASE_URL is not postgres).");
  } else {
    console.log("[setup-prisma] Using SQLite schema (default).");
  }
}
