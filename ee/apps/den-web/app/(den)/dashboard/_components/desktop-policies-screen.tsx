"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import {
  desktopPolicyKeys,
  isRestrictedDesktopPolicyValue,
  type DesktopPolicyDocument,
  type DesktopPolicyValue,
} from "@openwork/types/den/desktop-policies";
import { DenButton, buttonVariants } from "../../_components/ui/button";
import { DenCatalogList, DenCatalogRow } from "../../_components/ui/catalog-row";
import { DenNotice } from "../../_components/ui/notice";
import { getDesktopPolicyRoute, getNewDesktopPolicyRoute, getOrgAccessFlags, permissionLockReason } from "../../_lib/den-org";
import { useOrgDashboard } from "../_providers/org-dashboard-provider";
import {
  deleteDesktopPolicy,
  useOrgDesktopPolicies,
  type DenDesktopPolicy,
} from "./desktop-policy-data";
import { AdvancedPageTemplate } from "./advanced-page-template";
import { EnterprisePlanNotice } from "./enterprise-plan-notice";
import { useDenLocale, useDenT } from "../../../_lib/i18n/client";
import { formatDenDateTime } from "../../../_lib/i18n/den-format";
import type { DenLocale } from "../../../_lib/i18n/den-locale";
import type { DenTranslate } from "../../../_lib/i18n/messages";

function formatPolicyTimestamp(value: string | null, locale: DenLocale, t: DenTranslate) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return formatDenDateTime(locale, date, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }, "en-US");
}

function isRestrictedPolicy(policy: DesktopPolicyDocument) {
  if (policy.access) return policy.access.mode === "locked";
  return isRestrictedDesktopPolicyValue(
    Object.fromEntries(
      desktopPolicyKeys.map((key) => [key, policy[key] === true]),
    ) as Required<DesktopPolicyValue>,
  );
}

export function DesktopPoliciesScreen() {
  const t = useDenT();
  const locale = useDenLocale();
  const { orgId, orgSlug, orgContext, runReauthableAction } = useOrgDashboard();
  const { desktopPolicies, busy, error, reloadPolicies } = useOrgDesktopPolicies(orgId);
  const [deleting, setDeleting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageSuccess, setPageSuccess] = useState<string | null>(null);

  const visiblePolicies = useMemo(() => {
    const list = [...desktopPolicies];
    list.sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      if (a.isEnabled !== b.isEnabled) return a.isEnabled ? -1 : 1;
      if (a.priority !== b.priority) return b.priority - a.priority;
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aTime - bTime;
    });
    return list;
  }, [desktopPolicies]);
  const access = getOrgAccessFlags(
    orgContext?.currentMember.role ?? "member",
    orgContext?.currentMember.isOwner ?? false,
    orgContext?.currentMember.permissions,
  );
  const canManage = access.canManageDesktopPolicies;

  const softDeletePolicy = async (policy: DenDesktopPolicy) => {
    if (!canManage) {
      setPageError(t("denDesktopPolicies.error.deleteDenied"));
      return;
    }
    if (policy.isDefault || !confirm(t("denDesktopPolicies.dialog.deleteConfirm", { policyName: policy.policyName }))) return;
    setPageError(null);
    setPageSuccess(null);
    try {
      await runReauthableAction("delete-desktop-policy", async () => {
        setDeleting(true);
        await deleteDesktopPolicy(policy.id);
        setPageSuccess(t("denDesktopPolicies.status.deleted"));
        await reloadPolicies();
      });
    } catch (error) {
      setPageError(error instanceof Error ? error.message : t("denDesktopPolicies.error.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AdvancedPageTemplate tab="desktop-policies">
      <div className="mb-6 flex items-center justify-end">
        {canManage ? (
          <Link href={getNewDesktopPolicyRoute(orgSlug)} className={buttonVariants({ variant: "primary" })}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("denDesktopPolicies.action.newPolicy")}
          </Link>
        ) : (
          <DenButton type="button" icon={Plus} disabled>
            {t("denDesktopPolicies.action.newPolicy")}
          </DenButton>
        )}
      </div>

      {orgContext && !orgContext.entitlements.desktopPolicies ? <EnterprisePlanNotice feature={t("denDesktopPolicies.notice.featureName")} /> : null}
      {canManage ? null : <DenNotice tone="neutral" message={t("denDesktopPolicies.notice.readOnly", { reason: permissionLockReason("desktop_policies.manage") })} className="mb-6" />}
      {pageError ? <DenNotice message={pageError} className="mb-6" /> : null}
      {pageSuccess ? <DenNotice tone="neutral" message={pageSuccess} className="mb-6" /> : null}
      {error ? <DenNotice message={error} className="mb-6" /> : null}

      {busy ? (
        <div className="rounded-[28px] border border-gray-200 bg-white px-6 py-10 text-[15px] text-gray-500">{t("denDesktopPolicies.status.loading")}</div>
      ) : visiblePolicies.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center">
          <p className="text-[15px] font-semibold tracking-[-0.02em] text-gray-900">{t("denDesktopPolicies.empty.title")}</p>
          <p className="mx-auto mt-2 max-w-[520px] text-[13px] leading-6 text-gray-500">
            {t("denDesktopPolicies.empty.description")}
          </p>
        </div>
      ) : (
        <DenCatalogList
          label={t("denDesktopPolicies.list.count", { count: visiblePolicies.length })}
          valueLabel={t("denDesktopPolicies.column.priority")}
          valueWidth="150px"
        >
          {visiblePolicies.map((policy) => (
            <DenCatalogRow
              key={policy.id}
              title={policy.policyName}
              badge={policy.policy.access ? (
                <span className="text-xs text-gray-500">{t("denDesktopPolicies.badge.teamAccess", { mode: policy.policy.access.mode === "locked" ? t("denDesktopPolicies.badge.accessLocked") : t("denDesktopPolicies.badge.accessCustom") })}</span>
              ) : policy.isDefault || isRestrictedPolicy(policy.policy) ? (
                <span className="inline-flex items-center gap-1">
                  {policy.isDefault ? (
                    <span className="inline-flex items-center rounded-full border border-sky-100 bg-sky-50 px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.1em] leading-none text-sky-700">{t("denDesktopPolicies.badge.default")}</span>
                  ) : null}
                  {isRestrictedPolicy(policy.policy) ? (
                    <span
                      data-testid="desktop-policy-restricted-badge"
                      className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.1em] leading-none text-amber-700"
                    >
                      {t("denDesktopPolicies.badge.restricted")}
                    </span>
                  ) : null}
                </span>
              ) : undefined}
              description={policy.isEnabled ? t("denDesktopPolicies.status.enabled") : t("denDesktopPolicies.status.disabled")}
              value={policy.isDefault ? t("denDesktopPolicies.list.fallbackValue") : String(policy.priority)}
              valueCaption={t("denDesktopPolicies.list.createdOn", { date: formatPolicyTimestamp(policy.createdAt, locale, t) })}
              valueWidth="150px"
              action={
                <div className="flex shrink-0 items-center gap-2">
                  <Link href={getDesktopPolicyRoute(orgSlug, policy.id)} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                    {policy.policy.access ? t("denDesktopPolicies.action.viewTeamAccess") : canManage ? t("denDesktopPolicies.action.edit") : t("denDesktopPolicies.action.view")}
                  </Link>
                  {!policy.isDefault ? (
                    <DenButton type="button" variant="destructive" size="sm" onClick={() => void softDeletePolicy(policy)} disabled={!canManage || deleting}>{t("denDesktopPolicies.action.delete")}</DenButton>
                  ) : null}
                </div>
              }
            />
          ))}
        </DenCatalogList>
      )}
    </AdvancedPageTemplate>
  );
}
