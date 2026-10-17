"use client"

import { Tool } from "@/components/ui/tool"
import { t } from "@/i18n"
import type { QuestionToolPart } from "@/lib/build-in-tools"
import { toolDisplayTitle, truncateText } from "@/components/tools/path"

interface QuestionToolProps {
  part: QuestionToolPart
}

function getFirstQuestionLabel(part: QuestionToolPart) {
  const first = part.input?.questions?.[0]
  if (!first) {
    return undefined
  }

  const header = first.header?.trim() ?? ""
  const question = first.question?.trim() ?? ""
  const label = header || question
  return label ? truncateText(label, 56) : undefined
}

function getQuestionToolTitle(part: QuestionToolPart): string | null {
  const label = getFirstQuestionLabel(part)
  const count = part.input?.questions?.length ?? 0

  if (part.state === "output-error") {
    return label ?? t("session.tool_asked_question")
  }

  if (part.state !== "output-available") {
    return null
  }

  if (label) {
    return label
  }

  return count > 1
    ? t("session.tool_asked_questions", { count })
    : t("session.tool_asked_question")
}

function getQuestionToolDetail(part: QuestionToolPart): string | undefined {
  const count = part.input?.questions?.length ?? 0

  if (part.state === "output-available") {
    return t("session.tool_answered")
  }

  if (count > 1) {
    return t("session.tool_questions_count", { count })
  }

  return undefined
}

export function QuestionTool({ part }: QuestionToolProps) {
  return (
    <Tool
      toolPart={part}
      title={toolDisplayTitle(
        getQuestionToolTitle(part),
        getQuestionToolDetail(part)
      )}
    />
  )
}
