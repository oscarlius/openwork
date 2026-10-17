"use client"

import { Tool } from "@/components/ui/tool"
import { t } from "@/i18n"
import type { GlobToolPart } from "@/lib/build-in-tools"
import { parseFilename, toolDisplayTitle, truncateText } from "@/components/tools/path"

interface GlobToolProps {
  part: GlobToolPart
}

function getGlobToolTitle(part: GlobToolPart): string | null {
  const pattern = part.input?.pattern?.trim() ?? ""

  if (part.state === "output-error") {
    return pattern
      ? t("session.tool_search_attempted_pattern", { pattern: truncateText(pattern, 44) })
      : t("session.tool_search_attempted")
  }

  if (part.state !== "output-available") {
    return null
  }

  return pattern
    ? t("session.tool_searched_pattern", { pattern: truncateText(pattern, 44) })
    : t("session.tool_searched_code")
}

function getGlobToolDetail(part: GlobToolPart): string | undefined {
  const root = part.input?.path?.trim()
  if (!root) {
    return undefined
  }

  return t("session.tool_search_in", { path: parseFilename(root) })
}

export function GlobTool({ part }: GlobToolProps) {
  return (
    <Tool
      toolPart={part}
      title={toolDisplayTitle(getGlobToolTitle(part), getGlobToolDetail(part))}
    />
  )
}
