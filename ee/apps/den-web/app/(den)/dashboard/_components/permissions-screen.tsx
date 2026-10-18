"use client";

import Link from "next/link";
import { ChevronRight, LockKeyhole, Plus } from "lucide-react";
import { PERMISSION_KEYS } from "@openwork/types/den/permissions";
import { DenButton } from "../../_components/ui/button";
import { DenNotice } from "../../_components/ui/notice";
import {
  getNewRoleRoute,
  getNewTeamPermissionsRoute,
  getPermissionKeysRoute,
  getPermissionSetRoute,
  orgFeatureEnabled,
  permissionLockReason,
} from "../../_lib/den-org";
import { useOrgDashboard } from "../_providers/org-dashboard-provider";
import { LinkButton } from "./item-list";
import { RolesTab, canCreateRole } from "./roles-tab";
import { usePermissionSets, type PermissionSetSummary } from "./permissions-data";
import {
  PermissionAreaSection,
  PermissionRowsSkeleton,
  PermissionsAccessState,
  PermissionsPage,
  usePermissionsAccess,
} from "./permissions-ui";
import { useDenT } from "../../../_lib/i18n/client";
import type { DenTranslate } from "../../../_lib/i18n/messages";


/** Who a set applies to, as state (DESIGN.md P1). */
export function appliesToSummary(set: PermissionSetSummary, t: DenTranslate): string {
  const appliesTo = set.appliesTo;
  if (appliesTo.kind === "everyone") return t("denPermissions.list.appliesEveryone", { members: t("denMarketplace.detail.memberCount", { count: appliesTo.memberCount }) });
  if (appliesTo.kind === "admins") {
    const teams = appliesTo.adminTeams.length;
    if (teams === 0 && appliesTo.directAdminCount === 0) return t("denPermissions.list.appliesAdminsNone");
    return teams > 0
      ? t("denPermissions.list.appliesAdminsAndTeams", { admins: t("denCommon.count.admin", { count: appliesTo.directAdminCount }), teams: t("denPermissions.setPage.adminTeamCount", { count: teams }) })
      : t("denPermissions.list.appliesAdminsOnly", { admins: t("denCommon.count.admin", { count: appliesTo.directAdminCount }) });
  }
  const teamName = appliesTo.team?.name ?? t("denPermissions.list.deletedTeam");
  return t("denPermissions.list.appliesTeamNote", { team: teamName, members: t("denMarketplace.detail.memberCount", { count: appliesTo.memberCount }) });
}

function PermissionSetRow({ set, href }: { set: PermissionSetSummary; href: string }) {
  const t = useDenT();
  return (
    <Link
      href={href}
      data-testid="permission-set-row"
      data-permission-set-kind={set.kind}
      className="group flex min-h-12 items-center gap-3 py-2 transition-colors hover:bg-gray-50/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[13px] font-medium text-gray-900">{set.name}</span>
        <span className="truncate text-[12px] text-gray-500">{appliesToSummary(set, t)}</span>
      </div>
      <span className="shrink-0 text-[12px] text-gray-700">{t("denPermissions.setPage.allowedOf", { allowed: set.allowedCount, total: PERMISSION_KEYS.length })}</span>
      <ChevronRight className="size-4 shrink-0 text-gray-300 transition-colors group-hover:text-gray-500" aria-hidden="true" strokeWidth={1.5} />
    </Link>
  );
}

export function PermissionsScreen() {
  const t = useDenT();
  const { orgContext } = useOrgDashboard();
  const permissions = usePermissionsAccess();
  const ready = permissions.state === "ready" ? permissions : null;
  // teamRoles: this page is the Roles list, in the same words as Members › Roles.
  const teamRoles = orgContext ? orgFeatureEnabled(orgContext, "teamRoles") : false;
  const setsQuery = usePermissionSets(ready?.orgId ?? null, ready !== null && !teamRoles);

  if (teamRoles) {
    if (!ready) return <PermissionsPage title={t("denShell.pageTitle.roles")} testId="permissions-landing"><PermissionsAccessState access={permissions} /></PermissionsPage>;
    const create = canCreateRole({ permissionsFeature: true, canManageTeams: ready.access.canManageTeams, canManagePermissions: ready.access.canManagePermissions })
      ? <DenButton icon={Plus} href={getNewRoleRoute(ready.orgSlug)} data-testid="roles-create">{t("denPermissions.list.createRole")}</DenButton>
      : undefined;
    return <PermissionsPage title={t("denShell.pageTitle.roles")} testId="permissions-landing"><RolesTab action={create} /></PermissionsPage>;
  }
  const byPermission = ready ? <LinkButton href={getPermissionKeysRoute(ready.orgSlug)} variant="secondary" size="sm">{t("denPermissions.keysPage.title")}</LinkButton> : undefined;

  if (!ready) {
    return <PermissionsPage title={t("denShell.pageTitle.permissions")} testId="permissions-landing"><PermissionsAccessState access={permissions} /></PermissionsPage>;
  }

  const canManage = ready.access.canManagePermissions;
  const sets = setsQuery.data ?? [];
  const defaults = sets.filter((set) => set.kind !== "team");
  const teamSets = sets.filter((set) => set.kind === "team");
  const newButton = canManage ? (
    <LinkButton href={getNewTeamPermissionsRoute(ready.orgSlug)} variant="secondary" size="sm" data-testid="new-team-permissions">
      <Plus className="size-3.5" aria-hidden="true" />
      {t("denPermissions.newSetPage.createAction")}
    </LinkButton>
  ) : (
    <DenButton variant="secondary" size="sm" icon={LockKeyhole} disabled aria-describedby="permissions-read-only">{t("denPermissions.newSetPage.createAction")}</DenButton>
  );

  return (
    <PermissionsPage title={t("denShell.pageTitle.permissions")} action={byPermission} testId="permissions-landing">
      {!canManage ? <DenNotice tone="neutral" icon={LockKeyhole} message={<span id="permissions-read-only">{t("denOrgSettings.readOnly", { reason: permissionLockReason("permissions.manage") })}</span>} /> : null}
      {setsQuery.isError ? (
        <div className="flex flex-col items-start gap-2">
          <DenNotice tone="error" message={setsQuery.error instanceof Error ? setsQuery.error.message : t("denPermissions.list.loadError")} className="w-full" />
          <DenButton variant="secondary" size="sm" disabled={setsQuery.isFetching} onClick={() => void setsQuery.refetch()}>{t("denCommon.action.tryAgain")}</DenButton>
        </div>
      ) : setsQuery.isPending ? (
        <PermissionRowsSkeleton rows={4} />
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <PermissionAreaSection label={t("denPermissions.list.defaultsLabel")} testId="permissions-defaults">
              {defaults.map((set) => <PermissionSetRow key={set.id} set={set} href={getPermissionSetRoute(ready.orgSlug, set.id)} />)}
            </PermissionAreaSection>
            <p className="inline-flex items-center gap-1.5 text-[12px] text-gray-500">
              <LockKeyhole className="size-3.5" aria-hidden="true" strokeWidth={1.5} />
              {t("denPermissions.list.ownerNote")}
            </p>
          </div>
          <PermissionAreaSection label={t("denPermissions.list.teamLabel")} meta={newButton} testId="permissions-teams">
            {teamSets.length === 0 ? (
              <div className="flex min-h-12 items-center py-3 text-[13px] text-gray-500" data-testid="permissions-teams-empty">
                {t("denPermissions.list.noTeams")}
              </div>
            ) : teamSets.map((set) => <PermissionSetRow key={set.id} set={set} href={getPermissionSetRoute(ready.orgSlug, set.id)} />)}
          </PermissionAreaSection>
        </>
      )}
    </PermissionsPage>
  );
}
