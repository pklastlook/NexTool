/**
 * AIProvider interface (Prompt2 §1, §63, §77, §78).
 *
 * Implementations:
 *  - OpenAIProvider  — real OpenAI chat.completions API
 *  - NoopAIProvider  — type-safe placeholder that throws "not configured"
 *
 * Per Prompt2 §63 every generation returns its token usage AND a cost estimate
 * in cents (USD). Cost is computed from a per-model lookup table; if the model
 * is unknown we conservatively report 0 cents and surface the raw token count
 * so callers can still bill/track honestly.
 */
import type { OpenAI } from "openai";

/** Options shared by all generation methods. */
export interface GenerateOptions {
  /** Override the default model (e.g. "gpt-4o-mini"). */
  model?: string;
  /** Temperature 0..2. Defaults to 0.7. */
  temperature?: number;
  /** Max output tokens. */
  maxTokens?: number;
  /** Optional system prompt to prepend. */
  system?: string;
}

/** Standard generation result with token + cost tracking (Prompt2 §63). */
export interface GenerateResult {
  text: string;
  /** Total tokens consumed (prompt + completion). */
  tokensUsed: number;
  /** Estimated cost in USD cents, rounded. 0 when the model is unknown. */
  costCents: number;
}

/** Input shape for product-description generation. */
export interface ProductDescriptionInput {
  name: string;
  category?: string;
  features?: string[];
  audience?: string;
  tone?: string;
  keywords?: string[];
}

/** Input shape for SEO content generation. */
export interface SeoContentInput {
  topic: string;
  primaryKeyword: string;
  secondaryKeywords?: string[];
  audience?: string;
  wordCount?: number;
  format?: "blog-intro" | "meta-description" | "title-tag" | "outline";
}

/** Input shape for social caption generation. */
export interface SocialCaptionInput {
  platform: "instagram" | "twitter" | "linkedin" | "facebook" | "tiktok";
  topic: string;
  tone?: string;
  hashtags?: boolean;
  maxLength?: number;
}

/** Input shape for rewriting text. */
export interface RewriteInput {
  text: string;
  mode: "improve" | "simplify" | "expand" | "shorten" | "formal" | "casual";
  audience?: string;
}

/** A JSON-schema-ish definition for structured generation. */
export interface StructuredSchema {
  /** Short description of what the schema represents. */
  description: string;
  /** A JSON Schema object describing the desired output shape. */
  schema: Record<string, unknown>;
}

/**
 * AI provider contract. Implementations MUST:
 *  - Set `configured=false` when required env vars are missing.
 *  - NEVER throw from the constructor.
 *  - Throw a clear "not configured" error if a method is invoked while
 *    `configured` is false (so callers cannot silently consume a fake
 *    response — per Prompt2 §78).
 *  - Report real token usage and honest cost estimates on every response.
 */
export interface AIProvider {
  /** Lowercase identifier, e.g. "openai", "noop". */
  readonly name: string;
  /** True when real credentials are present and the client was built. */
  readonly configured: boolean;
  /** Low-level text generation. Used by all higher-level methods. */
  generateText(prompt: string, opts?: GenerateOptions): Promise<GenerateResult>;
  /** Generate a marketing product description. */
  generateProductDescription(input: ProductDescriptionInput, opts?: GenerateOptions): Promise<GenerateResult>;
  /** Generate SEO content (intro / meta description / title / outline). */
  generateSeoContent(input: SeoContentInput, opts?: GenerateOptions): Promise<GenerateResult>;
  /** Generate a platform-appropriate social caption. */
  generateSocialCaption(input: SocialCaptionInput, opts?: GenerateOptions): Promise<GenerateResult>;
  /** Rewrite text in a chosen mode. */
  rewriteText(input: RewriteInput, opts?: GenerateOptions): Promise<GenerateResult>;
  /** Summarize a longer document. */
  summarizeDocument(text: string, opts?: GenerateOptions): Promise<GenerateResult>;
  /** Clean up OCR'd text (de-hyphenate, fix common OCR errors, reflow). */
  cleanOcrText(text: string, opts?: GenerateOptions): Promise<GenerateResult>;
  /** Generate a JSON object conforming to the given schema. */
  generateStructuredData(input: string, schema: StructuredSchema, opts?: GenerateOptions): Promise<GenerateResult>;
}

/**
 * Optional SDK handle accessor — used by tests / health checks only.
 */
export interface AIProviderHandles {
  client?: OpenAI;
}
