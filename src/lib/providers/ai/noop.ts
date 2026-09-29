/**
 * NoopAIProvider — type-safe placeholder (Prompt2 §78).
 *
 * Returned by getAIProvider() when AI_API_KEY is missing. Every method throws
 * a clear, actionable error. We never return fake AI text.
 */
import type {
  AIProvider, GenerateOptions, GenerateResult,
  ProductDescriptionInput, SeoContentInput, SocialCaptionInput,
  RewriteInput, StructuredSchema,
} from "./types";

const NOT_CONFIGURED_ERROR = new Error(
  "AI provider is not configured. Set AI_API_KEY (and optionally AI_MODEL " +
  "/ AI_BASE_URL) in .env to enable real AI generation via OpenAI."
);

export class NoopAIProvider implements AIProvider {
  readonly name = "noop";
  readonly configured = false;

  async generateText(_prompt: string, _opts?: GenerateOptions): Promise<GenerateResult> {
    throw NOT_CONFIGURED_ERROR;
  }
  async generateProductDescription(_input: ProductDescriptionInput, _opts?: GenerateOptions): Promise<GenerateResult> {
    throw NOT_CONFIGURED_ERROR;
  }
  async generateSeoContent(_input: SeoContentInput, _opts?: GenerateOptions): Promise<GenerateResult> {
    throw NOT_CONFIGURED_ERROR;
  }
  async generateSocialCaption(_input: SocialCaptionInput, _opts?: GenerateOptions): Promise<GenerateResult> {
    throw NOT_CONFIGURED_ERROR;
  }
  async rewriteText(_input: RewriteInput, _opts?: GenerateOptions): Promise<GenerateResult> {
    throw NOT_CONFIGURED_ERROR;
  }
  async summarizeDocument(_text: string, _opts?: GenerateOptions): Promise<GenerateResult> {
    throw NOT_CONFIGURED_ERROR;
  }
  async cleanOcrText(_text: string, _opts?: GenerateOptions): Promise<GenerateResult> {
    throw NOT_CONFIGURED_ERROR;
  }
  async generateStructuredData(_input: string, _schema: StructuredSchema, _opts?: GenerateOptions): Promise<GenerateResult> {
    throw NOT_CONFIGURED_ERROR;
  }
}
