"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarClock, Cloud, ExternalLink, Monitor, Square } from "lucide-react";
import type { AutomationList, AutomationSchedule } from "@openwork/types/automations";
import { DenButton } from "../../_components/ui/button";
import { useDenFlow } from "../../_providers/den-flow-provider";
import { WorkflowArtifactResult } from "./workflow-artifact-result";
import {
  useAutomation,
  useAutomationArtifactSnapshot,
  useAutomationRun,
  useAutomationRuns,
  useAutomations,
  useCancelAutomationRun,
} from "./automation-data";
import { useDenT } from "../../../_lib/i18n/client";
import type { DenTranslate } from "../../../_lib/i18n/messages";

type AutomationListItem = AutomationList["items"][number];

const ACTIVE_RUN_STATUSES = new Set(["queued", "claimed", "running"]);

function statusTone(status: string) {
  return status === "failed" || status === "needs_attention" ? "bg-red-50 text-red-600" : status === "succeeded" || status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600";
}

function scheduleLabel(t: DenTranslate, schedule: AutomationSchedule) {
  if (schedule.kind === "once") return t("denWorkflow.automation.scheduleOnce", { when: new Date(schedule.at).toLocaleString(), timezone: schedule.timezone });
  const time = `${String(schedule.hour).padStart(2, "0")}:${String(schedule.minute).padStart(2, "0")}`;
  if (schedule.kind === "daily") return t("denWorkflow.automation.scheduleDaily", { time, timezone: schedule.timezone });
  const names = [t("denWorkflow.automation.daySun"), t("denWorkflow.automation.dayMon"), t("denWorkflow.automation.dayTue"), t("denWorkflow.automation.dayWed"), t("denWorkflow.automation.dayThu"), t("denWorkflow.automation.dayFri"), t("denWorkflow.automation.daySat")];
  return t("denWorkflow.automation.scheduleWeekly", { days: schedule.daysOfWeek.map((day) => names[day]).join(", "), time, timezone: schedule.timezone });
}

function placementLabel(t: DenTranslate, executionTarget: "desktop" | "cloud" | undefined) {
  return executionTarget === "cloud" ? "OpenWork Cloud" : t("denTeam.everyone.tabDesktop");
}

function PlacementIcon({ executionTarget }: { executionTarget: "desktop" | "cloud" | undefined }) {
  return executionTarget === "cloud" ? <Cloud className="h-3 w-3" /> : <Monitor className="h-3 w-3" />;
}

/** The surface that owns an Automation's lifecycle: Web for Cloud placement, Desktop for Desktop placement. */
function ManageLink({ item, openworkWebUrl }: { item: { automation: { id: string }; revision: { executionTarget?: "desktop" | "cloud" } }; openworkWebUrl: string }) {
  const t = useDenT();
  if (item.revision.executionTarget === "cloud") {
    const href = `${openworkWebUrl.replace(/\/$/, "")}/automations?automation=${encodeURIComponent(item.automation.id)}`;
    return <DenButton variant="secondary" size="sm" href={href} target="_blank" rel="noopener noreferrer" icon={ExternalLink}>{t("denWorkflow.automation.manageInWeb")}</DenButton>;
  }
  return <span className="inline-flex items-center gap-1.5 text-[12px] text-gray-400"><Monitor className="h-3.5 w-3.5" />{t("denWorkflow.automation.manageInDesktop")}</span>;
}

/** Groups the monitor list by what needs eyes first: running, needs attention, scheduled, paused. */
function groupItems(t: DenTranslate, items: AutomationListItem[]) {
  const running: AutomationListItem[] = [];
  const attention: AutomationListItem[] = [];
  const scheduled: AutomationListItem[] = [];
  const paused: AutomationListItem[] = [];
  for (const item of items) {
    if (item.latestRun && ACTIVE_RUN_STATUSES.has(item.latestRun.status)) running.push(item);
    else if (item.automation.state === "needs_attention") attention.push(item);
    else if (item.automation.state === "active") scheduled.push(item);
    else paused.push(item);
  }
  return [
    { title: t("denWorkflow.automation.groupRunning"), items: running },
    { title: t("denWorkflow.freshness.needsAttention"), items: attention },
    { title: t("denWorkflow.past.sourceScheduled"), items: scheduled },
    { title: t("denGateway.limitState.paused"), items: paused },
  ].filter((group) => group.items.length > 0);
}

export function AutomationsScreen() {
  const t = useDenT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { runtimeConfig } = useDenFlow();
  const automationId = searchParams.get("automation")?.trim() || null;
  const runId = searchParams.get("run")?.trim() || null;
  const listQuery = useAutomations();
  const detailQuery = useAutomation(automationId);
  const runsQuery = useAutomationRuns(automationId);
  const runQuery = useAutomationRun(runId);
  const latestSuccessfulRunQuery = useAutomationRun(detailQuery.data?.automation.latestSuccessfulRunId ?? null);
  const cancelRun = useCancelAutomationRun();
  const action = detailQuery.data?.revision.action;
  const configObjectId = action?.kind === "saved_script" ? action.script.configObjectId : null;
  const selectedSnapshot = useAutomationArtifactSnapshot(configObjectId, runQuery.data?.run.codemodeReceiptId ?? null);
  const latestSnapshot = useAutomationArtifactSnapshot(configObjectId, latestSuccessfulRunQuery.data?.run.codemodeReceiptId ?? null);

  const setQuery = (automation: string | null, run: string | null = null) => {
    const next = new URLSearchParams();
    if (automation) next.set("automation", automation);
    if (run) next.set("run", run);
    router.push(`${window.location.pathname}${next.size ? `?${next}` : ""}`);
  };

  if (listQuery.isLoading) return <div className="mx-auto max-w-[980px] px-6 py-8 text-[13px] text-gray-400">{t("denWorkflow.automation.listLoading")}</div>;
  if (listQuery.error) return <div className="mx-auto max-w-[980px] px-6 py-8 text-[13px] text-red-600">{listQuery.error.message}</div>;

  if (!automationId) {
    const items = listQuery.data?.items.filter((item) => item.automation.state !== "archived") ?? [];
    const groups = groupItems(t, items);
    return (
      <div className="mx-auto max-w-[980px] px-6 py-8 md:px-8" data-automations-monitor>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-gray-950">{t("denShell.nav.myAutomations")}</h1>
            <p className="mt-1 text-[13px] text-gray-400">{t("denWorkflow.automation.pageDescription")}</p>
          </div>
          <DenButton href={`${runtimeConfig.openworkWebUrl.replace(/\/$/, "")}/automations`} target="_blank" rel="noopener noreferrer" icon={ExternalLink}>{t("denWorkflow.automation.openInWeb")}</DenButton>
        </div>
        {items.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-8 text-center text-[13px] text-gray-400">{t("denWorkflow.automation.empty")}</div>
        ) : groups.map((group) => (
          <section key={group.title} className="mt-6">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-gray-400">{group.title}</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {group.items.map((item) => (
                <button key={item.automation.id} type="button" onClick={() => setQuery(item.automation.id)} className="rounded-2xl border border-gray-100 bg-white p-4 text-left transition hover:border-gray-200 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-[14px] font-semibold text-gray-900">{item.automation.name}</h3>
                      <p className="mt-1 line-clamp-2 text-[12px] text-gray-400">{item.revision.action?.kind === "saved_script" ? `${t("denWorkflow.automation.exactVersion")} ${item.revision.action.script.configObjectVersionId.slice(0, 8)}` : item.revision.instructions}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${statusTone(item.automation.state)}`}>{item.automation.state.replace("_", " ")}</span>
                  </div>
                  <p className="mt-3 text-[11px] text-gray-400">{scheduleLabel(t, item.revision.schedule)}</p>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
                    <span>{item.latestRun ? t("denWorkflow.automation.lastRunStatus", { status: item.latestRun.status }) : item.automation.nextDueAt ? t("denWorkflow.automation.nextRun", { when: new Date(item.automation.nextDueAt).toLocaleString() }) : t("denWorkflow.freshness.notRunYet")}</span>
                    <span className="flex items-center gap-1"><PlacementIcon executionTarget={item.revision.executionTarget} />{placementLabel(t, item.revision.executionTarget)}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  if (detailQuery.isLoading || !detailQuery.data) return <div className="mx-auto max-w-[980px] px-6 py-8 text-[13px] text-gray-400">{t("denWorkflow.automation.detailLoading")}</div>;
  const detail = detailQuery.data;
  const runs = runsQuery.data ?? [];
  const activeRun = runQuery.data?.run && ACTIVE_RUN_STATUSES.has(runQuery.data.run.status) ? runQuery.data.run : null;
  return (
    <div className="mx-auto max-w-[1080px] px-6 py-8 md:px-8" data-automations-monitor>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button type="button" aria-label={t("denWorkflow.automation.backAria")} onClick={() => setQuery(null)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-800"><ArrowLeft className="h-4 w-4" /></button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[20px] font-semibold text-gray-950">{detail.automation.name}</h1>
              <span className={`rounded-full px-2 py-0.5 text-[10px] ${statusTone(detail.automation.state)}`}>{detail.automation.state.replace("_", " ")}</span>
            </div>
            <p className="mt-1 text-[12px] text-gray-400">{t("denWorkflow.automation.revisionLabel", { version: detail.revision.version })} · {placementLabel(t, detail.revision.executionTarget)} · {scheduleLabel(t, detail.revision.schedule)}</p>
          </div>
        </div>
        <ManageLink item={detail} openworkWebUrl={runtimeConfig.openworkWebUrl} />
      </div>

      {detail.automation.needsAttentionReason ? <div className="mt-5 rounded-xl border border-[var(--dls-border)] bg-[var(--dls-hover)] px-4 py-3 text-[13px] text-[var(--dls-text-primary)]">{detail.automation.needsAttentionReason.message}</div> : null}
      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-gray-100 bg-white p-5">
            <h2 className="text-[14px] font-semibold text-gray-900">{action?.kind === "saved_script" ? t("denWorkflow.detail.workflowChip") : t("denWorkflow.automation.instructionsTitle")}</h2>
            {action?.kind === "saved_script" ? (
              <div className="mt-3 space-y-3 text-[12px]">
                <div><p className="text-gray-400">{t("denWorkflow.automation.exactVersion")}</p><p className="break-all font-mono text-gray-700">{action.script.configObjectVersionId}</p></div>
                <div><p className="text-gray-400">{t("denWorkflow.automation.inputLabel")}</p><pre className="mt-1 overflow-auto whitespace-pre-wrap rounded-xl bg-gray-950 p-3 font-mono text-[11px] text-gray-100">{JSON.stringify(action.input ?? {}, null, 2)}</pre></div>
              </div>
            ) : <p className="mt-3 whitespace-pre-wrap text-[13px] text-gray-700">{detail.revision.instructions}</p>}
          </section>
          {latestSnapshot.data ? (
            <section className="rounded-2xl border border-gray-100 bg-white p-5">
              <h2 className="text-[14px] font-semibold text-gray-900">{t("denWorkflow.automation.validatedTitle")}</h2>
              <p className="mt-1 text-[12px] text-gray-400">{t("denWorkflow.automation.validatedHint")}</p>
              <div className="mt-4"><WorkflowArtifactResult snapshot={latestSnapshot.data} lastSuccessful /></div>
            </section>
          ) : null}
          <section className="rounded-2xl border border-gray-100 bg-white p-5">
            <h2 className="flex items-center gap-2 text-[14px] font-semibold text-gray-900"><CalendarClock className="h-4 w-4" />{t("denWorkflow.automation.runHistory")}</h2>
            <div className="mt-3 space-y-2">
              {runs.length === 0 ? <p className="text-[13px] text-gray-400">{t("denWorkflow.past.empty")}</p> : runs.map((run) => (
                <button key={run.id} type="button" onClick={() => setQuery(detail.automation.id, run.id)} className="flex w-full items-center justify-between rounded-xl border border-gray-100 p-3 text-left hover:bg-gray-50">
                  <span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${statusTone(run.status)}`}>{run.status}</span>
                    <span className="ml-2 text-[11px] text-gray-400">{run.trigger}</span>
                    <span className="mt-1 block text-[11px] text-gray-400">{new Date(run.startedAt ?? run.createdAt).toLocaleString()}</span>
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-gray-400"><PlacementIcon executionTarget={run.executionTarget} />{placementLabel(t, run.executionTarget)}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
        <section className="h-fit rounded-2xl border border-gray-100 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[14px] font-semibold text-gray-900">{t("denWorkflow.automation.receiptTitle")}</h2>
            {activeRun ? <DenButton variant="destructive" size="sm" loading={cancelRun.isPending} onClick={() => void cancelRun.mutateAsync(activeRun.id)}><Square className="h-3 w-3" />{t("denWorkflow.automation.cancelRun")}</DenButton> : null}
          </div>
          {!runId ? <p className="mt-8 text-center text-[13px] text-gray-400">{t("denWorkflow.automation.receiptEmpty")}</p> : runQuery.isLoading ? <p className="mt-4 text-[13px] text-gray-400">{t("denWorkflow.automation.receiptLoading")}</p> : runQuery.data ? (
            <div className="mt-4 space-y-4">
              {cancelRun.error ? <div className="rounded-xl bg-red-50 p-3 text-[12px] text-red-600">{cancelRun.error.message}</div> : null}
              {runQuery.data.run.executionThread?.nativeThreadId ? (
                <div className="rounded-xl bg-gray-50 p-3 text-[11px] text-gray-500">
                  <p className="font-medium text-gray-700">{t("denWorkflow.automation.nativeThread")}</p>
                  <p className="mt-1 break-all font-mono">{runQuery.data.run.executionThread.nativeThreadId}</p>
                  {runQuery.data.run.executionThread.workspaceId ? <p className="mt-1 break-all font-mono">{t("denWorkflow.automation.workspaceId", { id: runQuery.data.run.executionThread.workspaceId })}</p> : null}
                </div>
              ) : null}
              {runQuery.data.run.error ? <div className="rounded-xl bg-red-50 p-3 text-[12px] text-red-600">{runQuery.data.run.error.message}</div> : null}
              {selectedSnapshot.data
                ? <WorkflowArtifactResult snapshot={selectedSnapshot.data} lastSuccessful={selectedSnapshot.data.receiptId === latestSnapshot.data?.receiptId} />
                : runQuery.data.run.validatedResult !== undefined
                  ? <pre className="overflow-auto whitespace-pre-wrap rounded-xl bg-gray-950 p-3 font-mono text-[11px] text-gray-100">{JSON.stringify(runQuery.data.run.validatedResult, null, 2)}</pre>
                  : runQuery.data.run.resultSummary
                    ? <p className="whitespace-pre-wrap text-[13px] leading-6 text-gray-700">{runQuery.data.run.resultSummary}</p>
                    : <p className="text-[13px] text-gray-400">{t("denWorkflow.automation.noResult")}</p>}
              <p className="text-[11px] text-gray-400">{t("denWorkflow.automation.usageLead")}{runQuery.data.run.usage.inputTokens ?? "—"} {t("denWorkflow.automation.usageInput")} · {runQuery.data.run.usage.outputTokens ?? "—"} {t("denWorkflow.automation.usageOutput")} · {runQuery.data.run.usage.costMicros === null ? t("denWorkflow.automation.costUnavailable") : `$${(runQuery.data.run.usage.costMicros / 1_000_000).toFixed(4)}`}</p>
              {runQuery.data.events.length ? (
                <ol className="space-y-2 border-l border-gray-200 pl-3">
                  {runQuery.data.events.map((event) => (
                    <li key={event.id} className="text-[11px]">
                      <div className="flex justify-between gap-2"><span className="font-medium text-gray-700">{event.type.replaceAll("_", " ")}</span><time className="text-gray-400">{new Date(event.createdAt).toLocaleTimeString()}</time></div>
                      <pre className="mt-1 overflow-auto whitespace-pre-wrap text-gray-500">{JSON.stringify(event.payload, null, 2)}</pre>
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          ) : <p className="mt-4 text-[13px] text-red-600">{t("denWorkflow.automation.receiptFailed")}</p>}
        </section>
      </div>
    </div>
  );
}
