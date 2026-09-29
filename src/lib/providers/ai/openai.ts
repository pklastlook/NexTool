/**
 * OpenAIProvider — real OpenAI chat.completions integration
 * (Prompt2 §1, §63, §77, §78).
 *
 * Marked NOT_CONFIGURED unless AI_API_KEY is present. When NOT_CONFIGURED every
 * method throws a clear error — we never return fake AI text.
 *
 * Cost tracking (§63): per-model USD-per-1M-tokens prices are hard-coded as a
 * lookup table. Prices reflect OpenAI's published API pricing at time of
 * writing. If the model is unknown we conservatively return 0 cents and rely
 * on the caller to log/track the raw token count.
 */
import OpenAI from "openai";
import type {
  AIProvider, GenerateOptions, GenerateResult,
  ProductDescriptionInput, SeoContentInput, SocialCaptionInput,
  RewriteInput, StructuredSchema,
} from "./types";

const API_KEY = process.env.AI_API_KEY ?? "";
const DEFAULT_MODEL = process.env.AI_MODEL ?? "gpt-4o-mini";

/**
 * Per-model USD price per 1M tokens (input, output).
 * Source: OpenAI pricing page, captured at implementation time. Update when
 * pricing changes — this is the only place that needs to change.
 */
const PRICING_USD_PER_1M: Record<string, { input: number; output: number }> = {
  "gpt-4o":        { input: 2.5,  output: 10 },
  "gpt-4o-mini":   { input: 0.15, output: 0.6 },
  "gpt-4o-2024-11-20": { input: 2.5, output: 10 },
  "gpt-4-turbo":   { input: 10,   output: 30 },
  "gpt-4":         { input: 30,   output: 60 },
  "gpt-3.5-turbo": { input: 0.5,  output: 1.5 },
  "o1-mini":       { input: 1.1,  output: 4.4 },
  "o1":            { input: 15,   output: 60 },
};

function estimateCostCents(model: string, promptTokens: number, completionTokens: number): number {
  const price = PRICING_USD_PER_1M[model] ?? PRICING_USD_PER_1M[DEFAULT_MODEL];
  if (!price) return 0;
  // USD = (promptTokens/1M * price.input) + (completionTokens/1M * price.output)
  // Cents = USD * 100
  const usd =
    (promptTokens / 1_000_000) * price.input +
    (completionTokens / 1_000_000) * price.output;
  return Math.max(0, Math.round(usd * 100));
}

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  readonly configured: boolean;
  private client: OpenAI | null = null;

  constructor() {
    this.configured = !!API_KEY;
    if (this.configured) {
      // Real OpenAI client. API key read from env at runtime — never logged.
      this.client = new OpenAI({
        apiKey: API_KEY,
        // Optional base URL override for Azure / OpenAI-compatible gateways.
        baseURL: process.env.AI_BASE_URL || undefined,
      });
    }
  }

  private requireClient(): OpenAI {
    if (!this.client) {
      throw new Error(
        "OpenAI AI provider is not configured. Set AI_API_KEY (and optionally " +
        "AI_MODEL / AI_BASE_URL) in .env to enable real AI generation."
      );
    }
    return this.client;
  }

  /** Core text generation method. */
  async generateText(prompt: string, opts: GenerateOptions = {}): Promise<GenerateResult> {
    const client = this.requireClient();
    const model = opts.model ?? DEFAULT_MODEL;
    const messages: { role: "system" | "user"; content: string }[] = [];
    if (opts.system) messages.push({ role: "system", content: opts.system });
    messages.push({ role: "user", content: prompt });

    const completion = await client.chat.completions.create({
      model,
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens,
    });

    const text = completion.choices?.[0]?.message?.content ?? "";
    const promptTokens = completion.usage?.prompt_tokens ?? 0;
    const completionTokens = completion.usage?.completion_tokens ?? 0;
    return {
      text,
      tokensUsed: promptTokens + completionTokens,
      costCents: estimateCostCents(model, promptTokens, completionTokens),
    };
  }

  async generateProductDescription(input: ProductDescriptionInput, opts: GenerateOptions = {}): Promise<GenerateResult> {
    const features = (input.features ?? []).join("; ");
    const keywords = (input.keywords ?? []).join(", ");
    const prompt =
      `Write a compelling product description for an e-commerce listing.\n` +
      `Product name: ${input.name}\n` +
      (input.category ? `Category: ${input.category}\n` : "") +
      (features ? `Key features: ${features}\n` : "") +
      (input.audience ? `Target audience: ${input.audience}\n` : "") +
      (input.tone ? `Tone: ${input.tone}\n` : "") +
      (keywords ? `SEO keywords to weave in: ${keywords}\n` : "") +
      `Length: 2-3 short paragraphs. Avoid hype words like "revolutionary".`;
    return this.generateText(prompt, { ...opts, system: opts.system ?? "You are an expert e-commerce copywriter." });
  }

  async generateSeoContent(input: SeoContentInput, opts: GenerateOptions = {}): Promise<GenerateResult> {
    const format = input.format ?? "blog-intro";
    const secondary = (input.secondaryKeywords ?? []).join(", ");
    let brief: string;
    switch (format) {
      case "meta-description":
        brief = `Write a single SEO meta description (max 155 characters) for a page about "${input.topic}". Primary keyword: ${input.primaryKeyword}.`; break;
      case "title-tag":
        brief = `Write an SEO title tag (max 60 characters) for a page about "${input.topic}". Primary keyword: ${input.primaryKeyword}.`; break;
      case "outline":
        brief = `Write an H2/H3 outline for a blog post about "${input.topic}" targeting the primary keyword "${input.primaryKeyword}". 6-10 sections.`; break;
      case "blog-intro":
      default:
        brief = `Write a blog-post intro (~${input.wordCount ?? 150} words) about "${input.topic}". Primary keyword: ${input.primaryKeyword}. Hook the reader in the first sentence.`;
    }
    if (secondary) brief += ` Secondary keywords: ${secondary}.`;
    if (input.audience) brief += ` Target audience: ${input.audience}.`;
    return this.generateText(brief, { ...opts, system: opts.system ?? "You are an SEO content strategist." });
  }

  async generateSocialCaption(input: SocialCaptionInput, opts: GenerateOptions = {}): Promise<GenerateResult> {
    const limits: Record<SocialCaptionInput["platform"], number> = {
      twitter: 280, instagram: 2200, linkedin: 3000, facebook: 5000, tiktok: 2200,
    };
    const maxLen = input.maxLength ?? limits[input.platform];
    const prompt =
      `Write a ${input.platform} caption about: ${input.topic}.\n` +
      (input.tone ? `Tone: ${input.tone}.\n` : "") +
      `Maximum length: ${maxLen} characters.\n` +
      (input.hashtags ? `Include 3-7 relevant hashtags at the end.\n` : `Do not include hashtags.\n`);
    return this.generateText(prompt, {
      ...opts,
      system: opts.system ?? `You are a social media manager specializing in ${input.platform}.`,
    });
  }

  async rewriteText(input: RewriteInput, opts: GenerateOptions = {}): Promise<GenerateResult> {
    const modeBrief: Record<RewriteInput["mode"], string> = {
      improve:  "Improve clarity, grammar, and flow while preserving meaning.",
      simplify: "Simplify the language so a 12-year-old can understand it.",
      expand:   "Expand the text with more detail and examples, preserving the original meaning.",
      shorten:  "Shorten the text by ~30% while keeping all key information.",
      formal:   "Rewrite in a formal, professional tone suitable for business communication.",
      casual:   "Rewrite in a casual, conversational tone.",
    };
    const prompt =
      `${modeBrief[input.mode]}\n` +
      (input.audience ? `Target audience: ${input.audience}\n` : "") +
      `Text:\n"""\n${input.text}\n"""`;
    return this.generateText(prompt, { ...opts, system: opts.system ?? "You are a professional editor." });
  }

  async summarizeDocument(text: string, opts: GenerateOptions = {}): Promise<GenerateResult> {
    const prompt =
      `Summarize the following document in 5-7 bullet points, then a 2-sentence TL;DR.\n` +
      `Document:\n"""\n${text}\n"""`;
    return this.generateText(prompt, { ...opts, system: opts.system ?? "You are a precise summarizer." });
  }

  async cleanOcrText(text: string, opts: GenerateOptions = {}): Promise<GenerateResult> {
    const prompt =
      `Clean up the following OCR output. Fix:\n` +
      `- Rejoin words split across line breaks by hyphens.\n` +
      `- Fix obvious OCR character substitutions (0/O, 1/l/I, rn/m, etc.) when contextually clear.\n` +
      `- Repair broken paragraph structure.\n` +
      `- Preserve original meaning — do NOT add or remove information.\n` +
      `OCR text:\n"""\n${text}\n"""`;
    return this.generateText(prompt, { ...opts, temperature: opts.temperature ?? 0.2, system: opts.system ?? "You are a meticulous OCR post-processor." });
  }

  async generateStructuredData(input: string, schema: StructuredSchema, opts: GenerateOptions = {}): Promise<GenerateResult> {
    // OpenAI's structured-outputs feature: pass response_format with json_schema.
    const prompt =
      `Task: ${schema.description}\n\n` +
      `Input:\n"""\n${input}\n"""\n\n` +
      `Respond ONLY with a JSON object matching this schema:\n` +
      `${JSON.stringify(schema.schema, null, 2)}`;
    const client = this.requireClient();
    const model = opts.model ?? DEFAULT_MODEL;
    const messages: { role: "system" | "user"; content: string }[] = [
      { role: "system", content: opts.system ?? "You return valid JSON only. No markdown, no prose." },
      { role: "user", content: prompt },
    ];
    const completion = await client.chat.completions.create({
      model,
      messages,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens,
      response_format: { type: "json_object" },
    });
    const text = completion.choices?.[0]?.message?.content ?? "";
    const promptTokens = completion.usage?.prompt_tokens ?? 0;
    const completionTokens = completion.usage?.completion_tokens ?? 0;
    return {
      text,
      tokensUsed: promptTokens + completionTokens,
      costCents: estimateCostCents(model, promptTokens, completionTokens),
    };
  }
}
