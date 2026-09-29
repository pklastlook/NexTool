'use client'

import { TOOL_COMPONENTS } from "@/components/tools/registry";
import { ConfigurableServerTool } from "@/components/tools/configurable-server-tool";
import { type ToolDef } from "@/lib/tool-registry";

/**
 * Client-side renderer for a tool's UI component.
 *
 * If the tool has a bespoke client component in the registry, render it.
 * Otherwise render the configurable server-tool wrapper which shows the
 * right options per tool slug and posts to /api/process/[slug].
 */
export function ToolRenderer({ tool }: { tool: ToolDef }) {
  const Comp = TOOL_COMPONENTS[tool.slug];

  if (!Comp) {
    return <ConfigurableServerTool tool={tool} />;
  }

  return <Comp />;
}
