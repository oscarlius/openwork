"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRightLeft, ExternalLink, KeyRound, Trash2, Users } from "lucide-react";
import { DenButton } from "../../_components/ui/button";
import { DenNotice } from "../../_components/ui/notice";
import { getRequestError, requestJson } from "../../_lib/den-flow";
import {
    getEditLlmProviderRoute,
    getAiGatewayProviderRoute,
    getLlmProvidersRoute,
} from "../../_lib/den-org";
import { useDenT } from "../../../_lib/i18n/client";
import type { DenTranslate } from "../../../_lib/i18n/messages";
import { useOrgDashboard } from "../_providers/org-dashboard-provider";
import { migrateLlmProviderToGateway } from "./inference-provider-data";
import { useGatewayDashboardAccess } from "./gateway-dashboard-capability-guard";
import {
    formatProviderTimestamp,
    getProviderApiBase,
    getProviderDocUrl,
    getProviderEnvNames,
    getProviderNpmPackage,
    useOrgLlmProviders,
} from "./llm-provider-data";
import { RuntimeEnvKeyChip, resolveRuntimeEnvKeys } from "./runtime-env-key";

function getLimitLabel(t: DenTranslate, config: Record<string, unknown>) {
    const limit =
        typeof config.limit === "object" && config.limit !== null
            ? (config.limit as Record<string, unknown>)
            : null;
    const context = typeof limit?.context === "number" ? limit.context : null;
    return context ? t("denModelProvider.detail.contextSize", { value: context.toLocaleString() }) : null;
}

export function LlmProviderDetailScreen({
    llmProviderId,
}: {
    llmProviderId: string;
}) {
    const router = useRouter();
    const t = useDenT();
    const gatewayEnabled = useGatewayDashboardAccess("manage-providers") === "enabled";
    const { orgId, orgSlug, runReauthableAction } = useOrgDashboard();
    const { llmProviders, busy, error, reloadProviders } =
        useOrgLlmProviders(orgId);
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [confirmingMigrate, setConfirmingMigrate] = useState(false);
    const [migrateBusy, setMigrateBusy] = useState(false);
    const [migrateError, setMigrateError] = useState<string | null>(null);

    useEffect(() => {
        setConfirmingMigrate(false);
        setMigrateError(null);
    }, [orgId, gatewayEnabled]);

    const provider = useMemo(
        () => llmProviders.find((entry) => entry.id === llmProviderId) ?? null,
        [llmProviderId, llmProviders],
    );

    async function deleteProvider() {
        if (!orgId || !provider) {
            return;
        }

        if (
            !window.confirm(
                t("denModelProvider.detail.deleteConfirm", { name: provider.name }),
            )
        ) {
            return;
        }

        setDeleteError(null);
        try {
            await runReauthableAction("delete-llm-provider", async () => {
                setDeleteBusy(true);
                const { response, payload } = await requestJson(
                    `/v1/llm-providers/${encodeURIComponent(provider.id)}`,
                    { method: "DELETE" },
                    12000,
                );

                if (response.status !== 204 && !response.ok) {
                    throw getRequestError(
                        payload,
                        response,
                        t("denModelProvider.detail.deleteFailedStatus", { status: response.status }),
                    );
                }

                await reloadProviders();
                router.push(getLlmProvidersRoute(orgSlug));
                router.refresh();
            });
        } catch (nextError) {
            setDeleteError(
                nextError instanceof Error
                    ? nextError.message
                    : t("denModelProvider.detail.deleteFailed"),
            );
        } finally {
            setDeleteBusy(false);
        }
    }

    async function moveToGateway() {
        if (!gatewayEnabled || !provider || !provider.canManage || provider.credentialMode === "per_member") {
            return;
        }
        setMigrateError(null);
        setMigrateBusy(true);
        try {
            await runReauthableAction("migrate-llm-provider", async () => {
                const gatewayProvider = await migrateLlmProviderToGateway(provider.id);
                router.push(getAiGatewayProviderRoute(orgSlug, gatewayProvider.id));
                router.refresh();
            });
        } catch (nextError) {
            setMigrateError(
                nextError instanceof Error
                    ? nextError.message
                    : t("denModelProvider.detail.moveToGatewayFailed"),
            );
        } finally {
            setMigrateBusy(false);
        }
    }

    if (busy && !provider) {
        return (
            <div className="mx-auto max-w-[1180px] px-6 py-8 md:px-8">
                <div className="rounded-[28px] border border-gray-200 bg-white px-6 py-10 text-[15px] text-gray-500">
                    {t("denModelProvider.detail.loading")}
                </div>
            </div>
        );
    }

    if (!provider) {
        return (
            <div className="mx-auto max-w-[1180px] px-6 py-8 md:px-8">
                <div className="rounded-[28px] border border-red-200 bg-red-50 px-6 py-4 text-[15px] text-red-700">
                    {error ?? t("denModelProvider.detail.notFound")}
                </div>
            </div>
        );
    }

    const envKeys = resolveRuntimeEnvKeys({
        declaredEnvNames: getProviderEnvNames(provider.providerConfig),
        scoped: provider.source === "models_dev",
        saved: true,
        runtimeEnvKeys: provider.runtimeEnvKeys,
    });
    const npmPackage = getProviderNpmPackage(provider.providerConfig);
    const apiBase = getProviderApiBase(provider.providerConfig);
    const docUrl = getProviderDocUrl(provider.providerConfig);

    return (
        <div className="mx-auto max-w-[1180px] px-6 py-8 md:px-8">
            <div className="mb-8 flex flex-col gap-3">
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                    {t("denModelProvider.detail.eyebrow")}
                </p>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                    <div>
                        <h1 className="text-[34px] font-semibold tracking-[-0.07em] text-gray-950">
                            {provider.name}
                        </h1>
                    </div>
                </div>
            </div>

            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                <Link
                    href={getLlmProvidersRoute(orgSlug)}
                    className="inline-flex items-center gap-2 text-[15px] font-medium text-gray-500 transition hover:text-gray-900"
                >
                    <ArrowLeft className="h-5 w-5" />
                    {t("denModelProvider.detail.backToProviders")}
                </Link>

                <div className="flex flex-wrap gap-3">
                    {gatewayEnabled && provider.canManage && provider.source === "models_dev" && provider.credentialMode !== "per_member" ? (
                        <DenButton
                            variant="secondary"
                            data-testid="llm-provider-move-to-gateway"
                            onClick={() => {
                                setMigrateError(null);
                                setConfirmingMigrate(true);
                            }}
                        >
                            <ArrowRightLeft className="h-4 w-4" />
                            {t("denModelProvider.detail.moveToGateway")}
                        </DenButton>
                    ) : null}
                    {provider.canManage && provider.source !== "openwork" ? (
                        <>
                            <Link
                                href={getEditLlmProviderRoute(
                                    orgSlug,
                                    provider.id,
                                )}
                            >
                                <DenButton variant="secondary">
                                    {t("denModelProvider.detail.editProvider")}
                                </DenButton>
                            </Link>
                            <DenButton
                                variant="destructive"
                                loading={deleteBusy}
                                onClick={() => void deleteProvider()}
                            >
                                <Trash2 className="h-4 w-4" />
                                {t("denModelProvider.detail.delete")}
                            </DenButton>
                        </>
                    ) : null}
                </div>
            </div>

            {gatewayEnabled && provider.source === "models_dev" && provider.credentialMode === "per_member" ? (
                <DenNotice className="mb-6" tone="info" message={t("denModelProvider.detail.moveToGatewayPerMemberNotice")} />
            ) : null}
            {deleteError ? (
                <div className="mb-6 rounded-[28px] border border-red-200 bg-red-50 px-6 py-4 text-[14px] text-red-700">
                    {deleteError}
                </div>
            ) : null}
            {gatewayEnabled && migrateError ? (
                <div className="mb-6 rounded-[28px] border border-red-200 bg-red-50 px-6 py-4 text-[14px] text-red-700">
                    {migrateError}
                </div>
            ) : null}

            {gatewayEnabled && confirmingMigrate ? (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/30 px-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="move-to-gateway-title"
                >
                    <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
                        <h2 id="move-to-gateway-title" className="text-[18px] font-semibold text-gray-950">
                            {t("denModelProvider.detail.moveToGatewayConfirm", { name: provider.name })}
                        </h2>
                        <p className="mt-2 text-[13px] leading-5 text-gray-500">
                            {t("denModelProvider.detail.moveToGatewayBody")}
                        </p>
                        {migrateError ? (
                            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
                                {migrateError}
                            </p>
                        ) : null}
                        <div className="mt-6 flex justify-end gap-2">
                            <DenButton variant="secondary" onClick={() => setConfirmingMigrate(false)}>
                                {t("denCommon.action.cancel")}
                            </DenButton>
                            <DenButton
                                data-testid="llm-provider-move-to-gateway-confirm"
                                loading={migrateBusy}
                                onClick={() => void moveToGateway()}
                            >
                                {t("denModelProvider.detail.moveToGateway")}
                            </DenButton>
                        </div>
                    </div>
                </div>
            ) : null}

            <section className="mb-8 rounded-[36px] border border-gray-200 bg-white p-8 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.24)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <h2 className="text-[24px] font-semibold tracking-[-0.05em] text-gray-950">
                            {t("denModelProvider.detail.providerConfiguration")}
                        </h2>
                    </div>

                    {provider.configRedacted ? null : (
                        <div
                            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium ${provider.hasApiKey ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                        >
                            <KeyRound className="h-4 w-4" />
                            {provider.hasApiKey
                                ? t("denModelProvider.detail.credentialSaved")
                                : t("denModelProvider.badge.credentialMissing")}
                        </div>
                    )}
                </div>

                <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-[24px] bg-gray-50 p-5">
                        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-gray-400">
                            {t("denModelProvider.detail.providerId")}
                        </p>
                        <p className="mt-3 text-[16px] font-medium text-gray-900">
                            {provider.providerId}
                        </p>
                    </div>
                    <div className="rounded-[24px] bg-gray-50 p-5">
                        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-gray-400">
                            {t("denModelProvider.detail.npmPackage")}
                        </p>
                        <p className="mt-3 text-[16px] font-medium text-gray-900">
                            {npmPackage ?? t("denModelProvider.detail.notSet")}
                        </p>
                    </div>
                    {provider.configRedacted ? null : (
                        <div className="rounded-[24px] bg-gray-50 p-5">
                            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-gray-400">
                                {t("denModelProvider.detail.apiBase")}
                            </p>
                            <p className="mt-3 break-all text-[16px] font-medium text-gray-900">
                                {apiBase ?? t("denModelProvider.detail.notSet")}
                            </p>
                        </div>
                    )}
                    <div className="rounded-[24px] bg-gray-50 p-5">
                        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-gray-400">
                            {t("denModelProvider.detail.updated")}
                        </p>
                        <p className="mt-3 text-[16px] font-medium text-gray-900">
                            {formatProviderTimestamp(provider.updatedAt)}
                        </p>
                    </div>
                </div>

                {provider.configRedacted ? (
                    <p data-testid="llm-provider-details-hidden" className="mt-6 rounded-[20px] bg-gray-50 px-5 py-4 text-[14px] text-gray-600">
                        {t("denModelProvider.detail.detailsHidden")}
                    </p>
                ) : (
                    <div className="mt-6 flex flex-wrap gap-2">
                        {envKeys.map((envKey) => (
                            <RuntimeEnvKeyChip
                                key={envKey.declared}
                                envKey={envKey}
                                className="rounded-full bg-gray-100 px-3 py-1 font-mono text-[12px] font-medium text-gray-600"
                            />
                        ))}
                        {docUrl ? (
                            <a
                                href={docUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-[12px] font-medium text-gray-600 transition hover:bg-gray-200"
                            >
                                {t("denModelProvider.detail.docs")}
                                <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                        ) : null}
                    </div>
                )}
            </section>

            <section className="mb-8 rounded-[36px] border border-gray-200 bg-white p-8 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.24)]">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-[24px] font-semibold tracking-[-0.05em] text-gray-950">
                            {t("denModelProvider.detail.selectedModels")}
                        </h2>
                    </div>
                    <div className="rounded-full bg-gray-100 px-4 py-2 text-[13px] font-medium text-gray-600">
                        {t("denModelProvider.list.modelCount", { count: provider.models.length })}
                    </div>
                </div>

                <div className="mt-8 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                    {provider.models.map((model) => {
                        const limitLabel = getLimitLabel(t, model.config);
                        return (
                            <div
                                key={model.id}
                                className="rounded-[24px] border border-gray-200 bg-gray-50 p-5"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-[17px] font-semibold tracking-[-0.03em] text-gray-950">
                                            {model.name}
                                        </p>
                                        <p className="mt-1 text-[13px] text-gray-500">
                                            {model.id}
                                        </p>
                                    </div>
                                    {limitLabel ? (
                                        <span className="rounded-full bg-white px-3 py-1 text-[12px] font-medium text-gray-600">
                                            {limitLabel}
                                        </span>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            <section className="mb-8 rounded-[36px] border border-gray-200 bg-white p-8 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.24)]">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-[24px] font-semibold tracking-[-0.05em] text-gray-950">
                            {t("denModelProvider.detail.access")}
                        </h2>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2 text-[13px] font-medium text-gray-600">
                        <Users className="h-4 w-4" />
                        {provider.access.allMembers
                            ? t("denModelProvider.detail.everyone")
                            : t("denModelProvider.detail.grantCount", { count: provider.access.memberCount + provider.access.teams.length })}
                    </div>
                </div>

                {provider.access.allMembers ? (
                    <p className="mt-6 rounded-[20px] bg-gray-50 px-5 py-4 text-[14px] text-gray-600">
                        {t("denModelProvider.detail.accessAllMembers")}
                    </p>
                ) : null}

                <div className="mt-8 grid gap-6 xl:grid-cols-2">
                    <div className="rounded-[24px] bg-gray-50 p-5">
                        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-gray-400">
                            {t("denModelProvider.detail.people")}
                        </p>
                        <div className="mt-4 grid gap-3">
                            {provider.access.membersHidden ? (
                                <p data-testid="llm-provider-members-hidden" className="text-[14px] text-gray-500">
                                    {t("denModelProvider.detail.membersHidden", { count: provider.access.memberCount })}
                                </p>
                            ) : provider.access.members.length === 0 ? (
                                <p className="text-[14px] text-gray-500">
                                    {t("denModelProvider.detail.noPeopleAccess")}
                                </p>
                            ) : (
                                provider.access.members.map((member) => (
                                    <div
                                        key={member.id}
                                        className="rounded-[18px] border border-gray-200 bg-white px-4 py-3"
                                    >
                                        <p className="text-[15px] font-medium text-gray-900">
                                            {member.user.name}
                                        </p>
                                        <p className="mt-1 text-[13px] text-gray-500">
                                            {member.user.email}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="rounded-[24px] bg-gray-50 p-5">
                        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-gray-400">
                            {t("denModelProvider.detail.teams")}
                        </p>
                        <div className="mt-4 grid gap-3">
                            {provider.access.teams.length === 0 ? (
                                <p className="text-[14px] text-gray-500">
                                    {t("denModelProvider.detail.noTeamAccess")}
                                </p>
                            ) : (
                                provider.access.teams.map((team) => (
                                    <div
                                        key={team.id}
                                        className="rounded-[18px] border border-gray-200 bg-white px-4 py-3"
                                    >
                                        <p className="text-[15px] font-medium text-gray-900">
                                            {team.name}
                                        </p>
                                        <p className="mt-1 text-[13px] text-gray-500">
                                            {t("denModelProvider.list.updatedOn", { date: formatProviderTimestamp(team.updatedAt) })}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {provider.source === "custom" && !provider.configRedacted ? (
                <section className="rounded-[36px] border border-gray-200 bg-white p-8 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.24)]">
                    <h2 className="text-[24px] font-semibold tracking-[-0.05em] text-gray-950">
                        {t("denModelProvider.detail.customPayload")}
                    </h2>
                    <p className="mt-2 text-[15px] text-gray-500">
                        {t("denModelProvider.detail.customPayloadDescription")}
                    </p>
                    <pre className="mt-6 overflow-x-auto rounded-[24px] bg-[#0f172a] p-5 text-[13px] leading-6 text-slate-100">
                        {JSON.stringify(provider.providerConfig, null, 2)}
                    </pre>
                </section>
            ) : null}
        </div>
    );
}
