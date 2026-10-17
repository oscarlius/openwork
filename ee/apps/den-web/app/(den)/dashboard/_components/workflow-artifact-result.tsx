"use client";

import type { ArtifactFreshness, WorkflowArtifactSnapshot } from "@openwork/types/workflows";
import { DenChip } from "../../_components/ui/chip";
import { DenNotice } from "../../_components/ui/notice";
import { useDenT } from "../../../_lib/i18n/client";
import { type DenTranslate } from "../../../_lib/i18n/messages";
import { WorkflowFriendlyValue } from "./workflow-friendly-value";

function decode(value: string) {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function tableCells(line: string) {
  const values: string[] = [];
  let current = "";
  for (const character of line.slice(1, -1)) {
    if (character === "|" && !current.endsWith("\\")) {
      values.push(decode(current.trim()));
      current = "";
      continue;
    }
    if (character === "|" && current.endsWith("\\")) current = `${current.slice(0, -1)}|`;
    else current += character;
  }
  values.push(decode(current.trim()));
  return values;
}

export function WorkflowMarkdownPreview({ markdown }: { markdown: string }) {
  if (markdown.startsWith("```json\n") && markdown.endsWith("\n```")) {
    return <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-gray-950 p-4 font-mono text-[12px] text-gray-100">{markdown.slice(8, -4)}</pre>;
  }
  const lines = markdown.split("\n");
  if (lines.length >= 2 && lines[0]?.startsWith("|") && lines[1]?.includes("---")) {
    const headers = tableCells(lines[0] ?? "");
    return (
      <div className="overflow-auto rounded-xl border border-gray-100">
        <table className="min-w-full text-left text-[12px]">
          <thead className="bg-gray-50"><tr>{headers.map((header) => <th key={header} className="px-3 py-2 font-medium text-gray-600">{header}</th>)}</tr></thead>
          <tbody>{lines.slice(2).map((line, rowIndex) => <tr key={`${rowIndex}:${line}`} className="border-t border-gray-100">{tableCells(line).map((entry, index) => <td key={`${index}:${entry}`} className="px-3 py-2 text-gray-700">{entry}</td>)}</tr>)}</tbody>
        </table>
      </div>
    );
  }
  return <p className="whitespace-pre-wrap text-[13px] leading-6 text-gray-700">{decode(markdown)}</p>;
}

function runTime(value: string, t: DenTranslate): string {
  const date = new Date(value);
  return t("denWorkflow.artifact.runAt", {
    date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    time: date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  });
}

function statusLine(snapshot: WorkflowArtifactSnapshot, freshness: ArtifactFreshness | undefined, lastSuccessful: boolean | undefined, t: DenTranslate): string {
  const parts = [
    t("denWorkflow.artifact.fromRun", { source: snapshot.source, time: runTime(snapshot.finishedAt, t) }),
    lastSuccessful ? t("denWorkflow.artifact.latestSuccessful") : null,
    freshness?.state === "stale" ? t("denWorkflow.freshness.stale") : null,
  ];
  return parts.filter((part) => part !== null).join(" · ");
}

export function WorkflowArtifactResult(props: {
  snapshot: WorkflowArtifactSnapshot;
  freshness?: ArtifactFreshness;
  lastSuccessful?: boolean;
  technical?: boolean;
}) {
  const t = useDenT();
  const snapshot = props.snapshot;
  return (
    <div className="space-y-3" data-testid="den-workflow-artifact-result">
      <p className="text-[12px] text-gray-500">{statusLine(snapshot, props.freshness, props.lastSuccessful, t)}</p>
      {props.freshness?.state === "needs_attention" ? <DenNotice tone="warning" message={props.freshness.reason} /> : null}
      {snapshot.contentDeletedAt ? (
        <p className="rounded-xl border border-dashed border-gray-200 p-4 text-[13px] text-gray-400">{t("denWorkflow.artifact.contentDeleted")}</p>
      ) : snapshot.value === null && snapshot.markdown ? (
        <WorkflowMarkdownPreview markdown={snapshot.markdown} />
      ) : <WorkflowFriendlyValue value={snapshot.value} />}
      {props.technical ? (
        <details className="border-t border-gray-100 pt-3">
          <summary className="cursor-pointer text-[12px] font-medium text-gray-600">{t("denWorkflow.artifact.technicalDetails")}</summary>
          <div className="mt-3 space-y-4">
            <div className="flex flex-wrap gap-2">
              <DenChip tone="neutral" mono>{t("denWorkflow.artifact.versionChip", { version: snapshot.configObjectVersionId.slice(0, 8) })}</DenChip>
              <DenChip tone="neutral">{snapshot.source === "scheduled" ? t("denWorkflow.artifact.scheduled") : t("denWorkflow.artifact.manual")}</DenChip>
            </div>
            {snapshot.markdown ? <WorkflowMarkdownPreview markdown={snapshot.markdown} /> : <p className="text-[13px] text-gray-400">{t("denWorkflow.artifact.noPreview")}</p>}
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-gray-950 p-4 font-mono text-[12px] text-gray-100">{JSON.stringify(snapshot.value, null, 2)}</pre>
            <dl className="grid gap-3 rounded-xl border border-gray-100 p-4 text-[11px] sm:grid-cols-2">
              <div><dt className="text-gray-400">{t("denWorkflow.artifact.receiptLabel")}</dt><dd className="break-all font-mono text-gray-700">{snapshot.receiptId}</dd></div>
              <div><dt className="text-gray-400">{t("denWorkflow.artifact.versionLabel")}</dt><dd className="break-all font-mono text-gray-700">{snapshot.configObjectVersionId}</dd></div>
              <div><dt className="text-gray-400">{t("denWorkflow.artifact.codeDigestLabel")}</dt><dd className="break-all font-mono">{snapshot.codeDigest}</dd></div>
              <div><dt className="text-gray-400">{t("denWorkflow.artifact.inputSchemaDigestLabel")}</dt><dd className="break-all font-mono">{snapshot.inputSchemaDigest ?? "—"}</dd></div>
              <div><dt className="text-gray-400">{t("denWorkflow.artifact.outputSchemaDigestLabel")}</dt><dd className="break-all font-mono">{snapshot.outputSchemaDigest ?? "—"}</dd></div>
              <div><dt className="text-gray-400">{t("denWorkflow.artifact.resultDigestLabel")}</dt><dd className="break-all font-mono">{snapshot.resultDigest ?? "—"}</dd></div>
              <div><dt className="text-gray-400">{t("denWorkflow.artifact.rendererLabel")}</dt><dd>{snapshot.rendererVersion ?? "—"}</dd></div>
              <div><dt className="text-gray-400">{t("denWorkflow.artifact.automationRunLabel")}</dt><dd className="break-all font-mono">{snapshot.automationRunId ?? t("denWorkflow.artifact.manual")}</dd></div>
            </dl>
          </div>
        </details>
      ) : null}
    </div>
  );
}
