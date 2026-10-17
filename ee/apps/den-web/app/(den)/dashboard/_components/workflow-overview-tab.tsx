"use client";

import { History, RefreshCw } from "lucide-react";
import type {
  GeneratedArtifactView,
  WorkflowArtifactSnapshot,
  WorkflowDetail,
} from "@openwork/types/workflows";
import { DenButton } from "../../_components/ui/button";
import { useDenT } from "../../../_lib/i18n/client";
import type { DenTranslate } from "../../../_lib/i18n/messages";
import { DenCard } from "../../_components/ui/card";
import { DenChip } from "../../_components/ui/chip";
import { DenList } from "../../_components/ui/list-row";
import { DenSectionHeader } from "../../_components/ui/section-header";
import { DenSwitch } from "../../_components/ui/switch";
import { DenTextarea } from "../../_components/ui/textarea";
import { WorkflowArtifactResult } from "./workflow-artifact-result";
import { WorkflowFlowDiagram } from "./workflow-flow-diagram";
import { formFieldsFromSchema, WorkflowInputForm } from "./workflow-input-form";
import { summarizeGraph } from "./workflow-plain-language";
import {
  workflowDiagramInput,
  type WorkflowFields,
} from "./use-workflow-detail-state";

export type WorkflowOverviewTabProps = {
  detail: WorkflowDetail;
  fields: WorkflowFields;
  views: GeneratedArtifactView[];
  technical: boolean;
  showJsonInput: boolean;
  parsedInputSchema: unknown;
  hasInputForm: boolean;
  inputFormValue: Record<string, unknown>;
  pending: boolean;
  viewPending: boolean;
  canManageDisplays: boolean;
  onTechnicalChange: (checked: boolean) => void;
  onShowJsonInputChange: (show: boolean) => void;
  onInputChange: (value: string) => void;
  onRun: () => void;
  onActivateView: (viewId: string, revisionId: string) => void;
  onRetireView: (viewId: string) => void;
};

function shortDigest(value: string | null) {
  return value ? `${value.slice(0, 15)}…${value.slice(-8)}` : "—";
}

function cspSummary(csp: {
  connectDomains: string[];
  resourceDomains: string[];
  frameDomains: string[];
  baseUriDomains: string[];
}, t: DenTranslate) {
  const domains = [...csp.connectDomains, ...csp.resourceDomains, ...csp.frameDomains, ...csp.baseUriDomains];
  return domains.length === 0 ? t("denWorkflow.technical.cspNoOrigins") : t("denWorkflow.technical.cspOrigins", { domains: domains.join(", ") });
}

function replay(snapshot: WorkflowArtifactSnapshot | null) {
  return snapshot ? {
    toolCalls: snapshot.toolCalls,
    status: snapshot.status,
    errorMessage: snapshot.errorMessage,
    finishedAt: snapshot.finishedAt,
  } : null;
}

export function WorkflowOverviewTab({
  detail,
  fields,
  views,
  technical,
  showJsonInput,
  parsedInputSchema,
  hasInputForm,
  inputFormValue,
  pending,
  viewPending,
  canManageDisplays,
  onTechnicalChange,
  onShowJsonInputChange,
  onInputChange,
  onRun,
  onActivateView,
  onRetireView,
}: WorkflowOverviewTabProps) {
  const t = useDenT();
  const latestReplay = detail.latestSnapshot ?? detail.latestSuccessfulSnapshot;
  const latestResult = detail.latestSnapshot ?? detail.latestSuccessfulSnapshot;
  const replayVersion = latestReplay
    ? detail.versions.find((version) => version.id === latestReplay.configObjectVersionId) ?? detail.currentVersion
    : detail.currentVersion;
  const graphSummary = replayVersion.graph ? summarizeGraph(replayVersion.graph) : null;
  const flowInput = workflowDiagramInput(latestReplay, replayVersion.exampleInput);

  return (
    <div className="grid gap-6" data-tab="overview" data-testid="workflow-overview" role="tabpanel" aria-label={t("denWorkflow.tabpanel.overview")}>
      <DenCard>
        <form
          aria-label={t("denWorkflow.run.formLabel")}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (detail.canRun && !pending) onRun();
          }}
        >
          <DenSectionHeader title={t("denWorkflow.run.title")} description={t("denWorkflow.run.description")} />
          {detail.canRun ? (
            <fieldset disabled={pending} className="mt-5 min-w-0 space-y-5">
              {hasInputForm ? (
                formFieldsFromSchema(parsedInputSchema)?.length === 0 ? (
                  <p className="text-[13px] text-gray-500">{t("denWorkflow.input.noneNeeded")}</p>
                ) : (
                  <WorkflowInputForm
                    schema={parsedInputSchema}
                    value={inputFormValue}
                    onChange={(next) => onInputChange(JSON.stringify(next, null, 2))}
                  />
                )
              ) : (
                <p className="text-[13px] text-gray-500">{t("denWorkflow.input.structuredNotice")}</p>
              )}
              <div className="text-[12px] text-gray-500">
                <DenButton type="button" variant="ghost" size="xs" aria-expanded={showJsonInput} onClick={() => onShowJsonInputChange(!showJsonInput)}>
                  {t("denWorkflow.input.advancedToggle")}
                </DenButton>
                {showJsonInput ? <label className="mt-3 block">
                  {t("denWorkflow.input.jsonLabel")}
                  <DenTextarea
                    aria-label={t("denWorkflow.input.runDetailsAria")}
                    className="mt-2 min-h-32 font-mono text-[11px]"
                    value={fields.input}
                    onChange={(event) => onInputChange(event.currentTarget.value)}
                  />
                </label> : null}
              </div>
              <div className="border-t border-gray-100 pt-4">
                <DenButton type="submit" icon={RefreshCw} loading={pending} className="w-full sm:w-auto">
                  {pending ? t("denWorkflow.run.running") : t("denWorkflow.run.submit")}
                </DenButton>
              </div>
            </fieldset>
          ) : (
            <p className="mt-5 text-[13px] text-gray-500">{t("denWorkflow.run.noPermission")}</p>
          )}
        </form>
      </DenCard>

      <DenCard>
        <DenSectionHeader
          title={t("denWorkflow.result.title")}
          description={t("denWorkflow.result.description")}
        />
        <div className="mt-5">
          {latestResult ? (
            <WorkflowArtifactResult
              snapshot={latestResult}
              freshness={latestResult.receiptId === detail.latestSnapshot?.receiptId ? detail.freshness : undefined}
              lastSuccessful={latestResult.receiptId === detail.latestSuccessfulSnapshot?.receiptId}
              technical={technical}
            />
          ) : (
            <p className="text-[13px] text-gray-400">{t("denWorkflow.result.empty")}</p>
          )}
        </div>
      </DenCard>

      <DenCard>
        <DenSectionHeader
          title={t("denWorkflow.how.title")}
          description={graphSummary?.sentence ?? t("denWorkflow.how.noDiagram")}
          action={
            <div className="flex flex-wrap items-center gap-3">
              {graphSummary ? (
                <DenChip tone="neutral" size="sm">
                  {graphSummary.stepCount === 1
                    ? t("denWorkflow.how.stepSingular", { count: graphSummary.stepCount })
                    : t("denWorkflow.how.stepPlural", { count: graphSummary.stepCount })}
                </DenChip>
              ) : null}
              <span className="flex items-center gap-2 text-[12px] text-gray-500">
                {t("denWorkflow.technical.switchLabel")}
                <DenSwitch
                  checked={technical}
                  onChange={onTechnicalChange}
                  size="sm"
                  aria-label={t("denWorkflow.technical.switchLabel")}
                />
              </span>
            </div>
          }
        />
        {replayVersion.graph ? (
          <div className="mt-5">
            <WorkflowFlowDiagram
              graph={replayVersion.graph}
              technical={technical}
              inputValues={flowInput}
              run={replay(latestReplay)}
            />
          </div>
        ) : null}
      </DenCard>

      <details className="rounded-2xl border border-gray-100 bg-white p-6">
        <summary className="mb-5 cursor-pointer text-[13px] font-medium text-gray-600">{t("denWorkflow.display.customize")}</summary>
        <DenSectionHeader
          title={t("denWorkflow.display.title")}
          description={t("denWorkflow.display.description")}
          action={
            <DenChip tone="neutral" size="sm">
              {views.length === 1
                ? t("denWorkflow.display.countSingular", { count: views.length })
                : t("denWorkflow.display.countPlural", { count: views.length })}
            </DenChip>
          }
        />
        <div className="mt-5">
          {views.length === 0 ? (
            <p className="border-t border-dashed border-gray-200 py-8 text-center text-[13px] text-gray-400">
              {t("denWorkflow.display.empty", { workflowName: detail.title })}
            </p>
          ) : (
            <DenList>
              {views.map((view) => (
                <div key={view.id} className="px-6 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[14px] font-medium text-gray-950">{view.title}</h3>
                        <DenChip tone={view.status === "active" ? "success" : "neutral"}>
                          {view.status === "active" ? t("denWorkflow.display.inUse") : t("denWorkflow.display.notInUse")}
                        </DenChip>
                      </div>
                      <p className="mt-1 text-[12px] text-gray-500">
                        {view.description || t("denWorkflow.display.fallbackDescription")}
                      </p>
                    </div>
                    {canManageDisplays && view.status === "active" ? (
                      <DenButton
                        variant="destructive"
                        size="sm"
                        loading={viewPending}
                        onClick={() => onRetireView(view.id)}
                      >
                        {t("denWorkflow.display.stopUsing")}
                      </DenButton>
                    ) : null}
                  </div>
                  <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4">
                    {view.revisions.map((revision) => {
                      const active = revision.id === view.activeRevisionId;
                      return (
                        <div key={revision.id}>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2 text-[12px] text-gray-500">
                              <History className="h-3.5 w-3.5" aria-hidden />
                              <span>{new Date(revision.createdAt).toLocaleString()}</span>
                              <DenChip tone={revision.buildStatus === "ready" ? active ? "success" : "neutral" : "danger"}>
                                {active ? t("denWorkflow.display.inUse") : revision.buildStatus === "ready" ? t("denWorkflow.revision.ready") : t("denWorkflow.revision.buildFailed")}
                              </DenChip>
                            </div>
                            {canManageDisplays && revision.buildStatus === "ready" && !active && revision.retiredAt === null ? (
                              <DenButton
                                size="xs"
                                variant="secondary"
                                loading={viewPending}
                                onClick={() => onActivateView(view.id, revision.id)}
                              >
                                {t("denWorkflow.revision.activate")}
                              </DenButton>
                            ) : null}
                          </div>
                          <details className="mt-3 border-t border-gray-100 pt-3 text-[11px] text-gray-500">
                            <summary className="cursor-pointer font-medium text-gray-600">{t("denWorkflow.technical.details")}</summary>
                            <p className="mt-2 break-all font-mono text-[10px]">{revision.id}</p>
                            <div className="mt-2 grid gap-1 md:grid-cols-2 xl:grid-cols-4">
                              <span>{revision.compilerName} {revision.compilerVersion}</span>
                              <span>React {revision.reactVersion}</span>
                              <span>{revision.compiledHtmlBytes === null ? t("denWorkflow.technical.noBundle") : t("denWorkflow.technical.bundleSize", { size: revision.compiledHtmlBytes.toLocaleString() })}</span>
                              <span>{new Date(revision.createdAt).toLocaleString()}</span>
                              <span className="md:col-span-2">{t("denWorkflow.technical.source", { digest: shortDigest(revision.sourceDigest) })}</span>
                              <span className="md:col-span-2">{t("denWorkflow.technical.resource", { digest: shortDigest(revision.resourceDigest) })}</span>
                              <span className="md:col-span-2 xl:col-span-4">{cspSummary(revision.csp, t)}</span>
                            </div>
                            <p className="mt-2 break-all font-mono text-[10px] text-gray-400">{revision.resourceUri}</p>
                            {revision.diagnostics.length ? (
                              <ul className="mt-2 flex flex-col gap-1 text-red-600">
                                {revision.diagnostics.map((diagnostic, index) => (
                                  <li key={`${diagnostic.message}-${index}`}>
                                    {diagnostic.level}: {diagnostic.message}
                                    {diagnostic.line ? ` (${diagnostic.line}:${diagnostic.column ?? 0})` : ""}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </details>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </DenList>
          )}
        </div>
      </details>
    </div>
  );
}
