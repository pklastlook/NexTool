/**
 * Worker mini-service — OCR queue.
 *
 * Tools routed here (see `queueForTool`):
 *   image-to-text
 *
 * Real OCR via Tesseract (`src/lib/processors/ocr.ts`). No mocks.
 *
 * Run from the main project root so bun loads `.env` and resolves `@/`
 * tsconfig paths:
 *   `bun --hot mini-services/worker-ocr/index.ts`
 */
import { Worker, type ProcessorFn } from "../../src/lib/queue/worker";
import { newWorkerId } from "../../src/lib/observability/log";
import { ocrImage } from "../../src/lib/processors/ocr";

const processors: Record<string, ProcessorFn> = {
  "image-to-text": async (input, options) => {
    const lang = typeof options.lang === "string" && options.lang.trim() !== ""
      ? options.lang.trim()
      : "eng";
    const result = await ocrImage(input.buf, input.name, lang);
    if (!result.text || result.text.trim().length === 0) {
      throw new Error("OCR produced no recognizable text. The image may be blank or low-quality.");
    }
    return {
      text: result.text,
      textFilename: "extracted-text.txt",
      meta: {
        language: result.language,
        characters: result.text.length,
        confidence: result.confidence,
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
const workerId = process.env.WORKER_ID || newWorkerId("ocr");
const worker = new Worker({ workerId, queue: "ocr", processors });

worker.start().catch((e) => {
  console.error("[worker-ocr] fatal:", e);
  process.exit(1);
});
