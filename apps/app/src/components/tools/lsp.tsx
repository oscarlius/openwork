"use client"

import { Tool } from "@/components/ui/tool"
import { t } from "@/i18n"
import type { LspInput, LspToolPart } from "@/lib/build-in-tools"
import { parseFilename, toolDisplayTitle } from "@/components/tools/path"

interface LspToolProps {
  part: LspToolPart
}

function lspOperationLabels(): Record<LspInput["operation"], string> {
  return {
    goToDefinition: t("session.tool_lsp_go_to_definition"),
    findReferences: t("session.tool_lsp_find_references"),
    hover: t("session.tool_lsp_hover"),
    documentSymbol: t("session.tool_lsp_document_symbols"),
    workspaceSymbol: t("session.tool_lsp_workspace_symbols"),
    goToImplementation: t("session.tool_lsp_go_to_implementation"),
    prepareCallHierarchy: t("session.tool_lsp_prepare_call_hierarchy"),
    incomingCalls: t("session.tool_lsp_incoming_calls"),
    outgoingCalls: t("session.tool_lsp_outgoing_calls"),
  }
}

function getLspToolTitle(part: LspToolPart): string | null {
  const filename = parseFilename(part.input.filePath)
  const operation = lspOperationLabels()[part.input.operation]

  if (part.state === "output-error") {
    return t("session.tool_lsp_attempted", { operation, file: filename })
  }

  if (part.state !== "output-available") {
    return null
  }

  return t("session.tool_lsp_completed", { operation, file: filename })
}

function getLspToolDetail(part: LspToolPart): string | undefined {
  const line = part.input.line
  const character = part.input.character
  const query = part.input.query?.trim()

  const location = `L${line}:${character}`
  if (query) {
    return `${location} · ${query}`
  }

  return location
}

export function LspTool({ part }: LspToolProps) {
  return (
    <Tool
      toolPart={part}
      title={toolDisplayTitle(getLspToolTitle(part), getLspToolDetail(part))}
    />
  )
}
