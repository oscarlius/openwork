"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronRight, RefreshCw } from "lucide-react";
import { useDenT } from "../../../_lib/i18n/client";
import { DenButton } from "../../_components/ui/button";
import { DenNotice } from "../../_components/ui/notice";
import { useOrgDashboard } from "../_providers/org-dashboard-provider";
import { EnterprisePlanNotice } from "./enterprise-plan-notice";
import { AnalyticsEmptyState, AnalyticsErrorState, AnalyticsPageHeader, analyticsPageClass, analyticsSurfaceClass } from "../_features/analytics/analytics-layout";
import { WorkflowFlowDiagram } from "./workflow-flow-diagram";
import { ItemPanel, ItemRow, ItemRowsSkeleton } from "./item-list";
import { LetterTile } from "./item-logo";
import {
  getWorkflowRuns,
  getErrorMessage,
  requestJson,
  type WorkflowRun,
} from "../../_lib/den-flow";

function formatDuration(durationMs: number): string {
  return durationMs < 1_000 ? `${durationMs} ms` : `${(durationMs / 1_000).toFixed(1)} s`;
}

function WorkflowRunCard({ run }: { run: WorkflowRun }) {
  const t = useDenT();
  const [previewOpen, setPreviewOpen] = useState(false);
  return <li data-run-id={run.id} data-testid={`workflow-run-${run.id}`} data-analytics-row>
    <ItemRow logo={<LetterTile name={run.workflow?.title ?? t("denWorkflow.runs.oneOffTask")} />}
      title={run.workflow ? <span data-testid={`workflow-run-link-${run.id}`}>{run.workflow.title}</span> : run.source === "adhoc" ? t("denWorkflow.runs.oneOffTask") : t("denWorkflow.runs.workflowRun")}
      href={run.workflow ? `/dashboard/library/workflows/${encodeURIComponent(run.workflow.configObjectId)}` : undefined}
      description={<><span className={run.status === "failed" ? "text-[var(--ow-danger)] sm:hidden" : "sm:hidden"}>{run.status === "succeeded" ? "Succeeded" : "Failed"} </span><time data-testid={`workflow-run-time-${run.id}`} dateTime={run.finishedAt}>{new Date(run.finishedAt).toLocaleString()}</time></>}
      comparison={<span className={`hidden shrink-0 text-[13px] sm:block ${run.status === "failed" ? "text-[var(--ow-danger)]" : "text-[var(--dls-text-secondary)]"}`}>{run.status === "succeeded" ? "Succeeded" : "Failed"}</span>}
      action={<DenButton variant="plain" size="inline" data-testid={`workflow-run-preview-${run.id}`} aria-expanded={previewOpen} aria-controls={`run-preview-${run.id}`} onClick={() => setPreviewOpen(!previewOpen)}><ChevronRight size={16} strokeWidth={1.5} aria-hidden className={previewOpen ? "rotate-90" : undefined} />{t("denWorkflow.runs.details")}</DenButton>} />
    {previewOpen ? <div id={`run-preview-${run.id}`}>
      {run.workflow ? run.workflow.graph ? <div data-testid={`workflow-run-visualization-${run.id}`} role="region" aria-label={t("denWorkflow.runs.visualizationAria", { workflowName: run.workflow.title })} className="px-5 pb-3">
        <WorkflowFlowDiagram graph={run.workflow.graph} />
      </div> : <p className="px-5 pb-3 text-[13px] text-[var(--dls-text-secondary)]">{t("denWorkflow.runs.visualizationMissing")}</p> : null}
      <WorkflowRunTechnicalDetails run={run} />
    </div> : null}
  </li>;
}

function WorkflowRunTechnicalDetails({ run }: { run: WorkflowRun }) {
  const t = useDenT();
  return <details className="px-5 pb-3 text-xs text-[var(--dls-text-secondary)]">
    <summary data-testid={`workflow-run-details-${run.id}`} className="cursor-pointer font-medium">{t("denWorkflow.technical.details")}</summary>
    <dl className="mt-3 flex flex-col gap-2">
      <div><dt>{t("denWorkflow.runs.sourceLabel")}</dt><dd className="break-all font-mono">{run.source}</dd></div>
      <div><dt>{t("denWorkflow.runs.toolCallsLabel")}</dt><dd>{run.toolCallCount}{run.toolCalls.length > 0 ? <span className="ml-2 break-all font-mono">{run.toolCalls.map((call) => call.name).join(", ")}</span> : null}</dd></div>
      <div><dt>{t("denWorkflow.runs.durationLabel")}</dt><dd>{formatDuration(run.durationMs)}</dd></div>
      {run.errorMessage ? <div><dt>{t("denWorkflow.runs.errorLabel")}</dt><dd className="break-words text-[var(--ow-danger)]">{run.errorMessage}</dd></div> : null}
    </dl>
  </details>;
}

export function WorkflowRunsScreen() {
  const t = useDenT();
  const { activeOrg, orgContext } = useOrgDashboard();
  const entitled = orgContext?.entitlements.analytics === true;
  const { data: runs, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ["workflow-runs", orgContext?.organization.id],
    enabled: entitled,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { response, payload } = await requestJson("/v1/workflow-runs", { method: "GET" }, 12000);
      if (!response.ok) throw new Error(getErrorMessage(payload, "Could not load workflow runs."));
      return getWorkflowRuns(payload);
    },
  });

  return <div className={analyticsPageClass}>
    <AnalyticsPageHeader orgSlug={activeOrg?.slug} active="workflows" title="Workflow Runs"
      action={entitled && !isError ? <DenButton variant="secondary" disabled={isFetching} onClick={() => void refetch()}>
        <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} aria-hidden="true" />{t("denWorkflow.runs.refresh")}
      </DenButton> : null} />
    {!entitled ? <EnterprisePlanNotice feature={t("denWorkflow.runs.planFeature")} detail={t("denWorkflow.runs.planDetail")} /> : <>
      {isError ? !runs ? <AnalyticsErrorState title={t("denWorkflow.runs.loadFailed")} onRetry={() => void refetch()} retrying={isFetching} /> : <DenNotice tone="neutral" presentation="inline" message={t("denWorkflow.runs.refreshFailed")} action={<DenButton variant="secondary" size="sm" disabled={isFetching} onClick={() => void refetch()}>{t("denWorkflow.runs.retry")}</DenButton>} /> : null}
      {isPending ? <ItemPanel><ItemRowsSkeleton label={t("denWorkflow.runs.loading")} rows={4} /></ItemPanel>
        : runs?.length === 0 ? <div className={analyticsSurfaceClass}>
          <AnalyticsEmptyState title={t("denWorkflow.runs.emptyTitle")}>{t("denWorkflow.runs.emptyDescription")}</AnalyticsEmptyState>
        </div> : runs ? <ol className="divide-y divide-[var(--dls-border)] rounded-2xl border border-[var(--dls-border)] bg-[var(--dls-surface)]" aria-label={t("denWorkflow.runs.listAria")}>
          {runs.map((run) => <WorkflowRunCard key={run.id} run={run} />)}
        </ol> : null}
    </>}
  </div>;
}
