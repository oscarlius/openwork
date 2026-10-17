"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, KeyRound, Plus, Search } from "lucide-react";
import { DashboardPageTemplate } from "../../_components/ui/dashboard-page-template";
import { DenBrandMark } from "../../_components/ui/brand-mark";
import { DenButton, buttonVariants } from "../../_components/ui/button";
import { DenCard } from "../../_components/ui/card";
import { DenChip } from "../../_components/ui/chip";
import { DenInput } from "../../_components/ui/input";
import { DenList, DenListRow } from "../../_components/ui/list-row";
import { DenNotice } from "../../_components/ui/notice";
import { DenOptionCard } from "../../_components/ui/option-card";
import { DenSectionHeader } from "../../_components/ui/section-header";
import {
  getLlmProviderRoute,
  getNewLlmProviderRoute,
} from "../../_lib/den-org";
import { useDenT } from "../../../_lib/i18n/client";
import { useOrgDashboard } from "../_providers/org-dashboard-provider";
import { useOrgDesktopPolicies } from "./desktop-policy-data";
import { readModelAccessState, saveModelAccess, type ModelAccessMode } from "./model-access-policy";
import {
  formatProviderTimestamp,
  getProviderDocUrl,
  getProviderIconSlug,
  useOrgLlmProviders,
  type DenLlmProvider,
} from "./llm-provider-data";

function LlmProviderList({ providers, orgSlug }: { providers: DenLlmProvider[]; orgSlug: string | null }) {
  const t = useDenT();
  return (
    <DenList>
      {providers.map((provider) => {
        const members = provider.access.memberCount;
        const teams = provider.access.teams.length;
        const accessText = provider.access.allMembers
          ? t("denModelProvider.list.everyone")
          : `${t("denCommon.count.people", { count: members })} · ${t("denModelProvider.list.teamCount", { count: teams })}`;
        return (
          <DenListRow
            key={provider.id}
            href={getLlmProviderRoute(orgSlug, provider.id)}
            dataAttributes={{ "data-testid": "llm-provider-card" }}
            leading={
              <DenBrandMark
                name={provider.name}
                simpleIconSlug={getProviderIconSlug(provider.providerId)}
                serviceUrl={getProviderDocUrl(provider.providerConfig)}
              />
            }
            title={provider.name}
            chips={
              <>
                <DenChip>{t("denModelProvider.list.modelCount", { count: provider.models.length })}</DenChip>
                {!provider.hasApiKey && !provider.configRedacted ? (
                  <DenChip tone="warning" icon={KeyRound}>
                    {t("denModelProvider.badge.credentialMissing")}
                  </DenChip>
                ) : null}
              </>
            }
            meta={`${provider.providerId} · ${accessText} · ${t("denModelProvider.list.updatedOn", { date: formatProviderTimestamp(provider.updatedAt) })}`}
            action={<ChevronRight aria-hidden className="h-4 w-4 text-gray-400" />}
          />
        );
      })}
    </DenList>
  );
}

export function LegacyProvidersSection({ orgId, orgSlug }: { orgId: string; orgSlug: string | null }) {
  const t = useDenT();
  const { llmProviders, busy, error, reloadProviders } = useOrgLlmProviders(orgId);
  const legacyProviders = llmProviders.filter((provider) => provider.source !== "openwork" && provider.organizationId === orgId);

  return (
    <section aria-label={t("denModelProvider.legacy.title")} data-testid="gateway-legacy-providers" className="mt-10 grid gap-4">
      <DenSectionHeader
        title={t("denModelProvider.legacy.title")}
        description={t("denModelProvider.legacy.description")}
      />
      <div>
        <Link
          href={getNewLlmProviderRoute(orgSlug)}
          data-testid="legacy-provider-create"
          className={buttonVariants({ variant: "secondary" })}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("denModelProvider.legacy.addAction")}
        </Link>
      </div>
      {busy ? (
        <p role="status" className="text-sm text-gray-500">{t("denModelProvider.legacy.loading")}</p>
      ) : error ? (
        <div className="flex flex-col items-start gap-4">
          <DenNotice tone="error" message={t("denModelProvider.legacy.error", { error })} />
          <DenButton variant="secondary" onClick={() => void reloadProviders()}>{t("denModelProvider.legacy.retry")}</DenButton>
        </div>
      ) : legacyProviders.length > 0 ? (
        <LlmProviderList providers={legacyProviders} orgSlug={orgSlug} />
      ) : null}
    </section>
  );
}

export function LlmProvidersScreen() {
  const t = useDenT();
  const { orgId, orgSlug, runReauthableAction } = useOrgDashboard();
  const { llmProviders, busy: providersBusy, error: providersError } = useOrgLlmProviders(orgId);
  const {
    desktopPolicies,
    busy: policiesBusy,
    error: policiesError,
    reloadPolicies,
  } = useOrgDesktopPolicies(orgId);
  const [query, setQuery] = useState("");
  const [accessMode, setAccessMode] = useState<ModelAccessMode>("open");
  const [adminExceptionChecked, setAdminExceptionChecked] = useState(true);
  const [zenAllowed, setZenAllowed] = useState(true);
  const [accessSaving, setAccessSaving] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [accessSaved, setAccessSaved] = useState<string | null>(null);

  const accessState = useMemo(() => readModelAccessState(desktopPolicies), [desktopPolicies]);
  const defaultPolicy = accessState.defaultPolicy;

  useEffect(() => {
    setAccessMode(accessState.mode);
    setAdminExceptionChecked(accessState.adminException);
    setZenAllowed(accessState.zenAllowed);
  }, [accessState]);

  const customProviders = useMemo(
    () => llmProviders.filter((provider) => provider.source !== "openwork"),
    [llmProviders],
  );

  const filteredProviders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return customProviders;
    }

    return customProviders.filter(
      (provider) =>
        provider.name.toLowerCase().includes(normalizedQuery) ||
        provider.providerId.toLowerCase().includes(normalizedQuery) ||
        provider.models.some((model) => model.name.toLowerCase().includes(normalizedQuery)),
    );
  }, [customProviders, query]);

  const modelCount = customProviders.reduce((total, provider) => total + provider.models.length, 0);
  const providerCount = customProviders.length;
  const hasOpenWorkModels = llmProviders.some((provider) => provider.source === "openwork");

  const accessOutcome = accessMode === "managed"
    ? modelCount > 0
      ? t("denModelProvider.access.outcomeManaged", {
          models: t("denModelProvider.list.modelCount", { count: modelCount }),
          providers: t("denModelProvider.list.providerCount", { count: providerCount }),
          extra: hasOpenWorkModels ? t("denModelProvider.access.outcomeManagedSuffix") : "",
        })
      : t("denModelProvider.access.outcomeManagedEmpty")
    : modelCount > 0
      ? t("denModelProvider.access.outcomeOpen", { models: t("denModelProvider.list.modelCount", { count: modelCount }) })
      : t("denModelProvider.access.outcomeOpenEmpty");
  const accessFormDisabled = policiesBusy || accessSaving || !defaultPolicy;

  const saveModelAccessPolicy = async () => {
    setAccessError(null);
    setAccessSaved(null);
    try {
      setAccessSaving(true);
      await runReauthableAction("save-model-access", async () => {
        await saveModelAccess(accessState, { mode: accessMode, adminException: adminExceptionChecked, zenAllowed });
        await reloadPolicies();
      });
      setAccessSaved(t("denModelProvider.access.saved"));
    } catch (error) {
      setAccessError(error instanceof Error ? error.message : t("denModelProvider.access.saveFailed"));
    } finally {
      setAccessSaving(false);
    }
  };

  return (
    <DashboardPageTemplate
      icon={KeyRound}
      title="Bring your Own Keys"
      description={t("denModelProvider.page.description")}
    >
      <DenCard data-testid="models-access-card" className="mb-8 grid gap-5">
        <DenSectionHeader
          title={t("denModelProvider.access.title")}
          description={t("denModelProvider.access.description")}
          action={
            <DenButton
              type="button"
              data-testid="models-access-save"
              onClick={() => void saveModelAccessPolicy()}
              loading={accessSaving}
              disabled={accessFormDisabled}
            >
              {t("denCommon.action.save")}
            </DenButton>
          }
        />

        {policiesError ? <DenNotice message={policiesError} tone="error" /> : null}
        {accessError ? <DenNotice message={accessError} tone="error" /> : null}
        {accessSaved ? (
          <p className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-[14px] text-emerald-700">
            {accessSaved}
          </p>
        ) : null}
        {!policiesBusy && !defaultPolicy ? (
          <p className="rounded-[24px] border border-[var(--dls-border)] bg-[var(--dls-hover)] px-5 py-4 text-[14px] text-[var(--dls-text-primary)]">
            {t("denModelProvider.access.missingDefaultPolicy")}
          </p>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-2">
          <DenOptionCard
            type="radio"
            name="models-access-mode"
            testId="models-access-open"
            title={t("denModelProvider.access.modeOpen")}
            description={t("denModelProvider.access.modeOpenDescription")}
            checked={accessMode === "open"}
            disabled={accessFormDisabled}
            onChange={() => {
              setAccessMode("open");
              setAccessSaved(null);
              setAccessError(null);
            }}
          />
          <DenOptionCard
            type="radio"
            name="models-access-mode"
            testId="models-access-managed"
            title={t("denModelProvider.access.modeManaged")}
            description={t("denModelProvider.access.modeManagedDescription")}
            checked={accessMode === "managed"}
            disabled={accessFormDisabled}
            onChange={() => {
              setAccessMode("managed");
              setAccessSaved(null);
              setAccessError(null);
            }}
          />
        </div>

        {accessMode === "managed" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <DenOptionCard
              type="checkbox"
              testId="models-access-admin-exception"
              title={t("denModelProvider.access.adminExceptionTitle")}
              checked={adminExceptionChecked}
              disabled={accessFormDisabled}
              onChange={(checked) => {
                setAdminExceptionChecked(checked);
                setAccessSaved(null);
                setAccessError(null);
              }}
            />
            <DenOptionCard
              type="checkbox"
              testId="models-access-zen"
              title={t("denModelProvider.access.zenTitle")}
              checked={zenAllowed}
              disabled={accessFormDisabled}
              onChange={(checked) => {
                setZenAllowed(checked);
                setAccessSaved(null);
                setAccessError(null);
              }}
            />
          </div>
        ) : null}

        <p data-testid="models-access-outcome" className="rounded-[20px] bg-gray-50 px-4 py-3 text-[13px] leading-6 text-gray-600">
          {accessOutcome}
        </p>
      </DenCard>

      <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <DenInput
          type="search"
          icon={Search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("denModelProvider.search.placeholder")}
        />

        <Link href={getNewLlmProviderRoute(orgSlug)} className={buttonVariants({ variant: "primary" })}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("denModelProvider.action.addProvider")}
        </Link>
      </div>

      {providersError ? <DenNotice message={providersError} tone="error" className="mb-6" /> : null}

      {providersBusy ? (
        <div className="rounded-[28px] border border-gray-200 bg-white px-6 py-10 text-[15px] text-gray-500">
          {t("denModelProvider.list.loading")}
        </div>
      ) : (
      <section className="grid gap-4">
        <DenSectionHeader
          title={t("denModelProvider.list.title")}
          description={t("denModelProvider.list.description")}
        />
        {filteredProviders.length === 0 ? (
          <div className="rounded-[32px] border border-dashed border-gray-200 bg-white px-6 py-12 text-center">
            <p className="text-[16px] font-medium tracking-[-0.03em] text-gray-900">
              {customProviders.length === 0 ? t("denModelProvider.empty.title") : t("denModelProvider.empty.searchTitle")}
            </p>
            <p className="mx-auto mt-3 max-w-[560px] text-[15px] leading-8 text-gray-500">
              {customProviders.length === 0
                ? t("denModelProvider.empty.description")
                : t("denModelProvider.empty.searchDescription")}
            </p>
          </div>
        ) : (
          <LlmProviderList providers={filteredProviders} orgSlug={orgSlug} />
        )}
      </section>
      )}
    </DashboardPageTemplate>
  );
}
