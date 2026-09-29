import { NextRequest, NextResponse } from "next/server";
import { TOOLS } from "@/lib/tool-registry";

/**
 * Capability discovery (Prompt2 §60).
 *
 * GET /api/capabilities?input=<mime>
 *
 * Returns the list of tools that genuinely accept the queried input MIME
 * type, along with their supported output formats. Used by the frontend to
 * show only the conversions that actually exist (no fake capability lists).
 *
 * If no `input` query param is given, returns the full registry grouped by
 * input format.
 */
export const dynamic = "force-dynamic";

interface CapEntry {
  slug: string;
  name: string;
  category: string;
  outputFormats: string[];
}

export async function GET(req: NextRequest) {
  const inputParam = req.nextUrl.searchParams.get("input")?.trim();

  if (inputParam) {
    const normalized = inputParam.toLowerCase();
    const matching = TOOLS.filter(
      (t) => t.inputFormats && t.inputFormats.some((f) => f.toLowerCase() === normalized)
    );
    const outputs: CapEntry[] = matching.map((t) => ({
      slug: t.slug,
      name: t.name,
      category: t.category,
      outputFormats: t.outputFormats ?? [],
    }));
    return NextResponse.json({
      input: normalized,
      count: outputs.length,
      outputs,
    });
  }

  // No filter: group all tools by input format.
  const map = new Map<string, CapEntry[]>();
  for (const t of TOOLS) {
    if (!t.inputFormats) continue;
    for (const f of t.inputFormats) {
      const key = f.toLowerCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({
        slug: t.slug,
        name: t.name,
        category: t.category,
        outputFormats: t.outputFormats ?? [],
      });
    }
  }
  return NextResponse.json({
    inputs: Array.from(map.entries()).map(([input, outputs]) => ({
      input,
      count: outputs.length,
      outputs,
    })),
  });
}
