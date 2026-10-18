/**
 * LiteLLM gateway provider requests and display helpers. Request bodies mirror
 * den-api's /v1/inference-providers/litellm schemas; keys are write-only and
 * never read back.
 */
import type { GatewayLiteLlmAttentionReason, GatewayLiteLlmStatus, GatewayLiteLlmSyncResult } from "@openwork/types/den/gateway";
import { auditOperationHeaders, type AuditOperationContext } from "@openwork/types/den/audit";
import { z } from "zod";
import type { DenTranslate } from "../../../_lib/i18n/messages";
import { getRequestError, requestJson } from "../../_lib/den-flow";
import { readInferenceProviderFromPayload, type DenInferenceProvider } from "./inference-provider-request";

export const LITELLM_PROVIDER_ID = "litellm";
export const LITELLM_DOC_URL = "https://docs.litellm.ai";

/** What the admin chooses: one shared key, each person pastes theirs, or OpenWork creates them. */
export type LiteLlmMode = "org" | "member" | "issued";
export type LiteLlmIssueStrategy = "per_team" | "mirror";
export type LiteLlmMirrorFallback = "per_team" | "error";

export type LiteLlmCreateInput = {
  name: string;
  baseUrl: string;
  mode: LiteLlmMode;
  apiKey: string;
  access: { allMembers: boolean; memberIds: string[]; teamIds: string[] };
  issueStrategy?: LiteLlmIssueStrategy;
  mirrorFallback?: LiteLlmMirrorFallback;
};

/** The admin-facing mode of a saved provider. */
export function liteLlmStatusMode(status: Pick<GatewayLiteLlmStatus, "mode" | "keySource">): LiteLlmMode {
  return status.mode === "org" ? "org" : status.keySource === "issued" ? "issued" : "member";
}

export function buildLiteLlmCreateBody(input: LiteLlmCreateInput) {
  return {
    name: input.name.trim() || "LiteLLM",
    baseUrl: input.baseUrl.trim(),
    mode: input.mode,
    ...(input.mode === "issued" ? { issueStrategy: input.issueStrategy ?? "per_team", mirrorFallback: input.mirrorFallback ?? "per_team" } : {}),
    apiKey: input.apiKey.trim(),
    ...(input.access.allMembers ? { allMembers: true } : {}),
    ...(input.access.memberIds.length ? { memberIds: [...new Set(input.access.memberIds)] } : {}),
    ...(input.access.teamIds.length ? { teamIds: [...new Set(input.access.teamIds)] } : {}),
  };
}

/** Client-side check before the server verifies the key against the proxy. */
export function liteLlmCreateError(input: LiteLlmCreateInput, t: DenTranslate): string | null {
  const baseUrl = input.baseUrl.trim();
  if (!baseUrl) return t("denModelProvider.litellm.errorProxyUrlRequired");
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return t("denModelProvider.litellm.errorProxyUrlScheme");
  } catch { return t("denModelProvider.litellm.errorFullUrl"); }
  if (!input.apiKey.trim()) return input.mode === "org" ? t("denModelProvider.litellm.errorKeyOrg")
    : input.mode === "issued" ? t("denModelProvider.litellm.errorKeyIssued")
      : t("denModelProvider.litellm.errorKeyMember");
  return null;
}

export function liteLlmKeyLabel(mode: LiteLlmMode, t: DenTranslate) {
  return mode === "org" ? t("denModelProvider.litellm.keyLabelOrg") : t("denModelProvider.litellm.keyLabelAdmin");
}

export function liteLlmModeLabel(mode: LiteLlmMode, t: DenTranslate) {
  return mode === "org" ? t("denModelProvider.litellm.modeOrg") : mode === "issued" ? t("denModelProvider.litellm.modeIssued") : t("denModelProvider.litellm.modeMember");
}

export function liteLlmIssueStrategyLabel(strategy: LiteLlmIssueStrategy, t: DenTranslate) {
  return strategy === "mirror" ? t("denModelProvider.litellm.issueStrategyMirror") : t("denModelProvider.litellm.issueStrategyPerTeam");
}

export function liteLlmMirrorFallbackLabel(fallback: LiteLlmMirrorFallback, t: DenTranslate) {
  return fallback === "error" ? t("denModelProvider.litellm.mirrorFallbackError") : t("denModelProvider.litellm.mirrorFallbackPerTeam");
}

export function liteLlmAttentionLabel(reason: GatewayLiteLlmAttentionReason, t: DenTranslate) {
  return reason === "not_in_litellm" ? t("denModelProvider.litellm.attentionNotInLiteLlm")
    : reason === "no_key_to_mirror" ? t("denModelProvider.litellm.attentionNoKeyToMirror")
      : reason === "no_models" ? t("denModelProvider.litellm.attentionNoModels")
        : t("denModelProvider.litellm.attentionCreateFailed");
}

export function liteLlmSpendLabel(status: Pick<GatewayLiteLlmStatus, "spendTracking">, t: DenTranslate) {
  return status.spendTracking ? t("denModelProvider.litellm.spendTracked") : t("denModelProvider.litellm.spendNotTracked");
}

export function liteLlmAccessTitle(mode: LiteLlmMode, t: DenTranslate) {
  return mode === "org" ? t("denModelProvider.litellm.accessTitleOrg") : mode === "issued" ? t("denModelProvider.litellm.accessTitleIssued") : t("denModelProvider.litellm.accessTitleMember");
}

export function liteLlmAccessGroupId(provider: Pick<DenInferenceProvider, "litellm" | "modelGroups">): string | null {
  const mode = provider.litellm ? liteLlmStatusMode(provider.litellm) : "org";
  const name = mode === "issued" ? "Gets a LiteLLM key" : mode === "member" ? "Can connect a LiteLLM key" : "All LiteLLM models";
  return provider.modelGroups?.find((group) => group.name === name)?.id ?? provider.modelGroups?.[0]?.id ?? null;
}

/** "Synced 5 min ago", or "Never synced". */
export function liteLlmSyncedLabel(lastSyncedAt: string | null, t: DenTranslate, now = Date.now()) {
  if (!lastSyncedAt) return t("denModelProvider.litellm.syncedNever");
  const at = new Date(lastSyncedAt).getTime();
  if (!Number.isFinite(at)) return t("denModelProvider.litellm.syncedNever");
  const minutes = Math.max(0, Math.round((now - at) / 60_000));
  if (minutes < 1) return t("denModelProvider.litellm.syncedJustNow");
  if (minutes < 60) return t("denModelProvider.litellm.syncedMinutes", { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t("denModelProvider.litellm.syncedHours", { count: hours });
  return t("denModelProvider.litellm.syncedDate", { date: new Date(at).toLocaleDateString() });
}

const syncResultSchema: z.ZodType<GatewayLiteLlmSyncResult> = z.object({
  modelCount: z.number(), groupCount: z.number(), teamCount: z.number(),
  members: z.object({ matched: z.number(), rejected: z.number(), unavailable: z.number(), removed: z.number() }),
  warnings: z.array(z.string()),
  issued: z.object({ people: z.number(), keys: z.number(), notInLiteLlm: z.number(), noKeyToMirror: z.number(), noModels: z.number(), errors: z.number(), removed: z.number() }).optional(),
});

function readResult(payload: unknown, t: DenTranslate) {
  const provider = readInferenceProviderFromPayload(payload);
  const sync = z.object({ sync: syncResultSchema }).safeParse(payload);
  if (!provider || !sync.success) throw new Error(t("denModelProvider.litellm.unexpectedResponse"));
  return { provider, sync: sync.data.sync };
}

export async function createLiteLlmProvider(input: LiteLlmCreateInput, t: DenTranslate, auditContext?: AuditOperationContext) {
  const { response, payload } = await requestJson("/v1/inference-providers/litellm", {
    method: "POST", body: JSON.stringify(buildLiteLlmCreateBody(input)), headers: auditOperationHeaders(auditContext),
  }, 30000);
  if (!response.ok) throw getRequestError(payload, response, t("denModelProvider.litellm.connectFailedStatus", { status: response.status }));
  return readResult(payload, t);
}

export async function syncLiteLlmProvider(providerId: string, t: DenTranslate, auditContext?: AuditOperationContext) {
  const { response, payload } = await requestJson(`/v1/inference-providers/${encodeURIComponent(providerId)}/litellm/sync`, {
    method: "POST", headers: auditOperationHeaders(auditContext),
  }, 60000);
  if (!response.ok) throw getRequestError(payload, response, t("denModelProvider.litellm.syncFailedStatus", { status: response.status }));
  return readResult(payload, t);
}

export async function replaceLiteLlmKey(providerId: string, apiKey: string, t: DenTranslate, auditContext?: AuditOperationContext) {
  return updateLiteLlm(providerId, { apiKey: apiKey.trim() }, t, auditContext);
}

export async function updateLiteLlmIssue(providerId: string, input: { issueStrategy?: LiteLlmIssueStrategy; mirrorFallback?: LiteLlmMirrorFallback }, t: DenTranslate, auditContext?: AuditOperationContext) {
  return updateLiteLlm(providerId, input, t, auditContext);
}

async function updateLiteLlm(providerId: string, body: Record<string, string>, t: DenTranslate, auditContext?: AuditOperationContext) {
  const { response, payload } = await requestJson(`/v1/inference-providers/${encodeURIComponent(providerId)}/litellm`, {
    method: "PATCH", body: JSON.stringify(body), headers: auditOperationHeaders(auditContext),
  }, 120000);
  if (!response.ok) throw getRequestError(payload, response, t("denModelProvider.litellm.replaceKeyFailedStatus", { status: response.status }));
  return readResult(payload, t);
}

export function liteLlmSyncSummary(sync: GatewayLiteLlmSyncResult, t: DenTranslate) {
  const parts = [t("denModelProvider.litellm.syncPartModels", { count: sync.modelCount })];
  if (sync.issued) {
    parts.push(t("denModelProvider.litellm.syncPartKeys", { count: sync.issued.people }));
    const missing = sync.issued.notInLiteLlm + sync.issued.noKeyToMirror + sync.issued.noModels + sync.issued.errors;
    if (missing) parts.push(t("denModelProvider.litellm.syncPartAttention", { count: missing }));
    if (sync.issued.removed) parts.push(t("denModelProvider.litellm.syncPartRemoved", { count: sync.issued.removed }));
  }
  if (sync.members.rejected) parts.push(t("denModelProvider.litellm.syncPartRejected", { count: sync.members.rejected }));
  if (sync.members.removed) parts.push(t("denModelProvider.litellm.syncPartLostAccess", { count: sync.members.removed }));
  return t("denModelProvider.litellm.syncSummary", { parts: parts.join("") });
}
