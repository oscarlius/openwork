"use client";

import {
  egressDiagnosticConfigurationSchema,
  egressDiagnosticRunSchema,
  type EgressDiagnosticRun,
  type EgressDiagnosticStep,
} from "@openwork/types/den/egress-diagnostics";
import {
  Activity,
  Check,
  CheckCircle2,
  CircleDashed,
  Copy,
  ExternalLink,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { getErrorMessage, requestJson } from "../../_lib/den-flow";
import { permissionLockReason } from "../../_lib/den-org";
import { DenButton, buttonVariants } from "../../_components/ui/button";
import { DenCard } from "../../_components/ui/card";
import { DenInput } from "../../_components/ui/input";
import { useDenT } from "../../../_lib/i18n/client";
import type { DenTranslate } from "../../../_lib/i18n/messages";

function statusStyles(status: EgressDiagnosticStep["status"]) {
  if (status === "passed") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "failed") return "border-red-200 bg-red-50 text-red-800";
  return "border-gray-200 bg-gray-50 text-gray-500";
}

function StatusIcon({ status }: { status: EgressDiagnosticStep["status"] }) {
  if (status === "passed") return <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />;
  if (status === "failed") return <XCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />;
  return <CircleDashed aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />;
}

function ownerLabel(t: DenTranslate, owner: EgressDiagnosticStep["owner"]) {
  if (owner === "network-administrator") return t("denDashboard.egress.ownerNetworkAdmin");
  if (owner === "openwork-support") return t("denDashboard.egress.ownerOpenworkSupport");
  return t("denDashboard.egress.ownerDenOperator");
}

function StepResult({ step }: { step: EgressDiagnosticStep }) {
  const t = useDenT();
  return (
    <li className={`grid gap-3 rounded-[22px] border px-4 py-4 ${statusStyles(step.status)}`}>
      <div className="flex min-w-0 items-start gap-3">
        <StatusIcon status={step.status} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium">{step.label}</p>
            <span className="text-[12px] font-semibold uppercase tracking-[0.1em]">
              {step.status} · {step.durationMs} ms
            </span>
          </div>
          <p className="mt-1 text-[13px] opacity-90">{step.message}</p>
        </div>
      </div>
      {step.httpStatuses.length > 0 ? (
        <p className="text-[12px]">
          {t("denDashboard.egress.httpResponses")} <span className="font-mono">{step.httpStatuses.join(" → ")}</span>
        </p>
      ) : null}
      {step.diagnosticIds.length > 0 ? (
        <div className="grid gap-1 text-[12px]">
          <span>{t("denDashboard.egress.remoteReferences")}</span>
          {step.diagnosticIds.map((diagnosticId) => (
            <code className="break-all" key={diagnosticId}>{diagnosticId}</code>
          ))}
        </div>
      ) : null}
      {step.status === "failed" ? (
        <div className="rounded-xl border border-current/15 bg-white/60 px-3 py-3 text-[13px]">
          <p><strong>{t("denDashboard.egress.suggestedOwner")}</strong> {ownerLabel(t, step.owner)}</p>
          <p className="mt-1"><strong>{t("denDashboard.egress.nextAction")}</strong> {step.action}</p>
          {step.code ? <p className="mt-1"><strong>{t("denDashboard.egress.failureCode")}</strong> <code>{step.code}</code></p> : null}
        </div>
      ) : null}
    </li>
  );
}

export function EgressDiagnosticsCard({ canView, canManage }: { canView: boolean; canManage: boolean }) {
  const t = useDenT();
  const [available, setAvailable] = useState(false);
  const [targetOrigin, setTargetOrigin] = useState<string | null>(null);
  const [missingConfiguration, setMissingConfiguration] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EgressDiagnosticRun | null>(null);
  const [copied, setCopied] = useState(false);
  const [bearerTokenDraft, setBearerTokenDraft] = useState("");
  const [savingBearerToken, setSavingBearerToken] = useState(false);
  const [editingBearerToken, setEditingBearerToken] = useState(false);

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function loadConfiguration() {
      setLoading(true);
      try {
        const { response, payload } = await requestJson("/v1/diagnostics/egress", { method: "GET" }, 12_000);
        if (!response.ok) {
          throw new Error(getErrorMessage(payload, `Could not load egress diagnostics (${response.status}).`));
        }
        const parsed = egressDiagnosticConfigurationSchema.safeParse(payload);
        if (!parsed.success) throw new Error("Den returned an invalid diagnostics configuration response.");
        if (!cancelled) {
          setAvailable(parsed.data.available);
          setTargetOrigin(parsed.data.targetOrigin);
          setMissingConfiguration(parsed.data.missingConfiguration);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : t("denDashboard.egress.loadFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadConfiguration();
    return () => { cancelled = true; };
  }, [canView, t]);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1_600);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function runDiagnostic() {
    if (!canManage) {
      setError(t("denDashboard.egress.runDenied"));
      return;
    }

    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const { response, payload } = await requestJson("/v1/diagnostics/egress", { method: "POST" }, 90_000);
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, `Egress diagnostic could not start (${response.status}).`));
      }
      const parsed = egressDiagnosticRunSchema.safeParse(payload);
      if (!parsed.success) throw new Error("Den returned an invalid egress diagnostic result.");
      setResult(parsed.data);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : t("denDashboard.egress.runFailed"));
    } finally {
      setRunning(false);
    }
  }

  async function saveBearerToken() {
    if (!canManage) {
      setError(t("denDashboard.egress.tokenDenied"));
      return;
    }

    const bearerToken = bearerTokenDraft.trim();
    if (bearerToken.length < 24) {
      setError(t("denDashboard.egress.tokenTooShort"));
      return;
    }
    setSavingBearerToken(true);
    setError(null);
    try {
      const { response, payload } = await requestJson("/v1/diagnostics/egress/token", {
        method: "PUT",
        body: JSON.stringify({ bearerToken }),
      }, 12_000);
      if (!response.ok) throw new Error(getErrorMessage(payload, `Could not save the diagnostic token (${response.status}).`));
      setBearerTokenDraft("");
      setAvailable(true);
      setMissingConfiguration([]);
      setEditingBearerToken(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("denDashboard.egress.tokenSaveFailed"));
    } finally {
      setSavingBearerToken(false);
    }
  }

  async function copyRunId() {
    if (!result) return;
    await navigator.clipboard.writeText(result.runId);
    setCopied(true);
  }

  return (
    <DenCard size="spacious" className="grid gap-6" data-testid="egress-diagnostics-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid max-w-[660px] gap-2">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-gray-400">{t("denDashboard.egress.eyebrow")}</p>
          <h2 className="text-[24px] font-semibold tracking-[-0.04em] text-gray-900">{t("denDashboard.egress.title")}</h2>
          <p className="text-[14px] text-gray-500">
            {t("denDashboard.egress.description")}
          </p>
        </div>
        <DenButton
          type="button"
          icon={Activity}
          loading={running}
          disabled={!canManage || loading || !available}
          onClick={() => void runDiagnostic()}
        >
          {t("denDashboard.egress.runButton")}
        </DenButton>
      </div>

      <div className="rounded-[22px] border border-gray-200 bg-gray-50 px-4 py-4 text-[13px] text-gray-600">
        <p><strong>{t("denDashboard.egress.fixedTarget")}</strong> {targetOrigin ? <code className="break-all">{targetOrigin}</code> : t("denDashboard.egress.notConfigured")}</p>
        <p className="mt-1">{t("denDashboard.egress.targetHint")}</p>
      </div>

      {canView && !canManage ? <p className="text-[13px] text-gray-500">{t("denDesktopPolicies.notice.readOnly", { reason: permissionLockReason("egress_diagnostics.manage") })}</p> : null}
      {loading ? <p className="text-[13px] text-gray-500" role="status">{t("denDashboard.egress.configLoading")}</p> : null}
      {!loading && canView && available && !editingBearerToken ? (
        <div className="flex items-center justify-between gap-3 rounded-[22px] border border-gray-200 bg-gray-50 px-4 py-3 text-[13px] text-gray-600">
          <p>{t("denDashboard.egress.tokenConfigured")}</p>
          <DenButton type="button" size="sm" variant="secondary" onClick={() => setEditingBearerToken(true)} disabled={!canManage}>
            {t("denDashboard.egress.changeToken")}
          </DenButton>
        </div>
      ) : null}
      {!loading && canView && (!available || editingBearerToken) ? (
        <div className="rounded-[22px] border border-[var(--dls-border)] bg-[var(--dls-hover)] px-4 py-4 text-[13px] text-[var(--dls-text-primary)]" role="status">
          <p className="font-medium">{available ? t("denDashboard.egress.replaceToken") : t("denDashboard.egress.addTokenTitle")}</p>
          <p className="mt-1">{t("denDashboard.egress.addTokenHint")}</p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="grid min-w-[280px] flex-1 gap-1">
              <span className="text-[12px] font-medium">{t("denDashboard.egress.tokenLabel")}</span>
              <DenInput
                autoComplete="new-password"
                minLength={24}
                onChange={(event) => setBearerTokenDraft(event.target.value)}
                placeholder={t("denDashboard.egress.tokenPlaceholder")}
                type="password"
                value={bearerTokenDraft}
                disabled={!canManage}
              />
            </label>
            <DenButton type="button" loading={savingBearerToken} onClick={() => void saveBearerToken()} disabled={!canManage}>
              {t("denDashboard.egress.saveToken")}
            </DenButton>
            {available ? (
              <DenButton type="button" size="sm" variant="secondary" onClick={() => setEditingBearerToken(false)}>
                {t("denCommon.action.cancel")}
              </DenButton>
            ) : null}
          </div>
        </div>
      ) : null}
      {error ? <div className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-4 text-[13px] text-red-800" role="alert">{error}</div> : null}

      {result ? (
        <section className="grid gap-4" aria-live="polite">
          <div className={`rounded-[22px] border px-4 py-4 ${result.overallStatus === "passed" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
            <p className="font-semibold">{result.overallStatus === "passed" ? t("denDashboard.egress.resultPassed") : t("denDashboard.egress.resultStopped", { step: result.failedStep ?? t("denDashboard.egress.unknownStep") })}</p>
            <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-[12px]">{t("denDashboard.egress.runId")}</span>
              <code className="min-w-0 break-all text-[12px]">{result.runId}</code>
              <DenButton type="button" size="sm" variant="secondary" icon={copied ? Check : Copy} onClick={() => void copyRunId()}>
                {copied ? t("denSetup.install.copied") : t("denOrgSettings.copy")}
              </DenButton>
              <a className={buttonVariants({ variant: "secondary", size: "sm" })} href={result.supportUrl} target="_blank" rel="noreferrer">
                {t("denDashboard.egress.openSupportTrace")} <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
          <ol className="grid gap-3">
            {result.steps.map((step) => <StepResult key={step.id} step={step} />)}
          </ol>
        </section>
      ) : null}
    </DenCard>
  );
}
