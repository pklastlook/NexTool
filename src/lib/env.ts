/**
 * Typed env accessor (server-side only).
 * Reads process.env once at module load.
 */
function read(key: string): string | undefined {
  const v = process.env[key];
  return v && v.trim().length > 0 ? v.trim() : undefined;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  LOG_LEVEL: read("LOG_LEVEL") || "info",
  AUTH_SECRET: read("AUTH_SECRET"),
  NEXTAUTH_URL: read("NEXTAUTH_URL"),

  DATABASE_URL: read("DATABASE_URL") || "file:./db/custom.db",

  REDIS_URL: read("REDIS_URL"),

  STORAGE_ENDPOINT: read("STORAGE_ENDPOINT"),
  STORAGE_REGION: read("STORAGE_REGION"),
  STORAGE_BUCKET: read("STORAGE_BUCKET"),
  STORAGE_ACCESS_KEY: read("STORAGE_ACCESS_KEY"),
  STORAGE_SECRET_KEY: read("STORAGE_SECRET_KEY"),
  STORAGE_FORCE_PATH_STYLE: read("STORAGE_FORCE_PATH_STYLE") === "true",

  EMAIL_PROVIDER: read("EMAIL_PROVIDER"),
  EMAIL_API_KEY: read("EMAIL_API_KEY"),
  EMAIL_FROM: read("EMAIL_FROM"),
  EMAIL_SMTP_HOST: read("EMAIL_SMTP_HOST"),
  EMAIL_SMTP_PORT: read("EMAIL_SMTP_PORT"),
  EMAIL_SMTP_USER: read("EMAIL_SMTP_USER"),
  EMAIL_SMTP_PASS: read("EMAIL_SMTP_PASS"),

  PAYMENT_PROVIDER: read("PAYMENT_PROVIDER"),
  PAYMENT_SECRET: read("PAYMENT_SECRET"),
  PAYMENT_WEBHOOK_SECRET: read("PAYMENT_WEBHOOK_SECRET"),

  AI_PROVIDER: read("AI_PROVIDER"),
  AI_API_KEY: read("AI_API_KEY"),
  ZAI_API_KEY: read("ZAI_API_KEY"),

  TURNSTILE_SITE_KEY: read("TURNSTILE_SITE_KEY"),
  TURNSTILE_SECRET_KEY: read("TURNSTILE_SECRET_KEY"),

  SENTRY_DSN: read("SENTRY_DSN"),

  ANALYTICS_KEY: read("ANALYTICS_KEY"),

  MALWARE_SCANNER: read("MALWARE_SCANNER"),
  CLAMD_HOST: read("CLAMD_HOST"),
  CLAMD_PORT: read("CLAMD_PORT"),
} as const;
