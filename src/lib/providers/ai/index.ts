/**
 * AI provider factory (Prompt2 §1, §63, §77).
 *
 * Selection rules:
 *  - AI_PROVIDER=openai (or unset) AND AI_API_KEY present
 *      -> OpenAIProvider
 *  - Otherwise
 *      -> NoopAIProvider (configured=false; every method throws clearly)
 *
 * The instance is cached for the lifetime of the process.
 */
import type { AIProvider } from "./types";
import { OpenAIProvider } from "./openai";
import { NoopAIProvider } from "./noop";

let cached: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (cached) return cached;

  const kind = (process.env.AI_PROVIDER ?? "openai").toLowerCase().trim();
  const hasKey = !!process.env.AI_API_KEY;

  if (kind === "openai" && hasKey) {
    cached = new OpenAIProvider();
  } else if (kind === "openai" && !hasKey) {
    // Real architecture, NOT_CONFIGURED. Returned so the health system can
    // report status honestly. Invoking any method throws a clear error.
    cached = new OpenAIProvider();
  } else {
    cached = new NoopAIProvider();
  }
  return cached;
}

export type {
  AIProvider, GenerateOptions, GenerateResult,
  ProductDescriptionInput, SeoContentInput, SocialCaptionInput,
  RewriteInput, StructuredSchema, AIProviderHandles,
} from "./types";
