"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { ChevronRight, History, LockKeyhole, ShieldCheck, Users } from "lucide-react";
import { PERMISSION_KEYS, getPermissionDefinition, isPermissionKey, type PermissionKey } from "@openwork/types/den/permissions";
import { DenButton, buttonVariants } from "../../_components/ui/button";
import { DenNotice } from "../../_components/ui/notice";
import { DenStickyActionBar } from "../../_components/ui/sticky-action-bar";
import { type TabItem, UnderlineTabs } from "../../_components/ui/tabs";
import { getMembersRoute, getPermissionsRoute, getTeamRoute, orgFeatureEnabled, permissionLockReason } from "../../_lib/den-org";
import { useDenT } from "../../../_lib/i18n/client";
import type { DenMessageKey, DenTranslate } from "../../../_lib/i18n/messages";
import { useOrgDashboard } from "../_providers/org-dashboard-provider";
import { useDenToast } from "./den-toast";
import {
  PermissionsRequestError,
  usePermissionSet,
  usePermissionSetHistory,
  useRemoveTeamPermissions,
  useSharedRolesOn,
  useUpdatePermissionSet,
  type PermissionChange,
  type PermissionHistoryItem,
  type PermissionSetDetail,
  type PermissionStatus,
} from "./permissions-data";
import {
  PermissionEditor,
  PermissionRowsSkeleton,
  PermissionsAccessState,
  PermissionsPage,
  RelativeTime,
  usePermissionsAccess,
  type PermissionEditorRow,
  type PermissionsAccess,
} from "./permissions-ui";
import { TEAM_ROLE_LABELS, roleKindLabel, roleName } from "./team-roles";
import { RoleNameField, SharedRoleTeams } from "./shared-role-teams";

type ReadyAccess = Extract<PermissionsAccess, { state: "ready" }>;
type SetTab = "teams" | "permissions" | "history";

/** teamRoles: a permission set's page is its role's page, named and linked like one. */
function useTeamRolesOn(): boolean {
  const { orgContext } = useOrgDashboard();
  return orgContext ? orgFeatureEnabled(orgContext, "teamRoles") : false;
}

export function PermissionSetScreen({ permissionSetId }: { permissionSetId: string }) {
  const permissions = usePermissionsAccess();
  const teamRoles = useTeamRolesOn();
  if (permissions.state !== "ready") {
    return <PermissionsPage title={teamRoles ? "Role" : "Permissions"} testId="permission-set"><PermissionsAccessState access={permissions} /></PermissionsPage>;
  }
  return <PermissionSetContent key={permissionSetId} ready={permissions} permissionSetId={permissionSetId} teamRoles={teamRoles} />;
}

function PermissionSetContent({ ready, permissionSetId, teamRoles }: { ready: ReadyAccess; permissionSetId: string; teamRoles: boolean }) {
  const t = useDenT();
  const query = usePermissionSet(ready.orgId, permissionSetId);
  // Lives above the editor, which remounts after each save, so Undo and errors survive it.
  const update = useUpdatePermissionSet(ready.orgId, permissionSetId);
  // sharedRoles: a custom role's page opens on its teams, and the role has its own name.
  const sharedRoles = useSharedRolesOn();
  const [chosenTab, setTab] = useState<SetTab | null>(null);
  const rolesBack = { href: `${getMembersRoute(ready.orgSlug)}?tab=roles`, label: "Roles" };
  const listBack = teamRoles ? rolesBack : { href: getPermissionsRoute(ready.orgSlug), label: "Permissions" };
  const loadingTitle = teamRoles ? "Role" : "Permissions";

  if (query.isError) {
    const notFound = query.error instanceof PermissionsRequestError && query.error.status === 404;
    const gone = teamRoles ? t("denPermissions.setPage.roleGone") : t("denPermissions.setPage.permissionsGone");
    return (
      <PermissionsPage title={loadingTitle} back={listBack} testId="permission-set">
        <div className="flex flex-col items-start gap-2">
          <DenNotice tone="error" className="w-full" message={notFound ? gone : query.error instanceof Error ? query.error.message : t("denPermissions.setPage.loadError")} />
          {notFound ? null : <DenButton variant="secondary" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}>{t("denCommon.action.tryAgain")}</DenButton>}
        </div>
      </PermissionsPage>
    );
  }
  if (!query.data) {
    return <PermissionsPage title={loadingTitle} back={listBack} testId="permission-set"><PermissionRowsSkeleton /></PermissionsPage>;
  }

  const set = query.data;
  const sharedCustom = sharedRoles && set.kind === "team";
  // A custom role goes back to its team, where it is shown and changed (with sharedRoles, to Roles).
  const back = teamRoles && !sharedCustom && set.kind === "team" && set.team?.name
    ? { href: getTeamRoute(ready.orgSlug, set.team.id), label: set.team.name }
    : listBack;
  const allowedLabel = t("denPermissions.setPage.allowedOf", { allowed: set.allowedCount, total: PERMISSION_KEYS.length });
  const tabs: readonly TabItem<SetTab>[] = [
    ...(sharedCustom && set.archivedAt === null ? [{ value: "teams" as const, label: t("denPermissions.setPage.tabTeams"), icon: Users }] : []),
    { value: "permissions", label: "Permissions", icon: ShieldCheck },
    { value: "history", label: t("denPermissions.setPage.tabHistory"), icon: History },
  ];
  const tab: SetTab = chosenTab && tabs.some((entry) => entry.value === chosenTab) ? chosenTab : tabs[0].value;
  const setTeamNames = set.teams.map((team) => team.name ?? t("denPermissions.list.deletedTeam"));
  const impact = sharedCustom && setTeamNames.length > 0
    ? t("denPermissions.setPage.impact", {
        teams: setTeamNames.length > 2 ? `${setTeamNames.slice(0, -1).join(", ")} and ${setTeamNames[setTeamNames.length - 1]}` : setTeamNames.join(" and "),
        people: t("denCommon.count.people", { count: set.appliesTo.kind === "team" ? set.appliesTo.memberCount : 0 }),
      })
    : undefined;
  const removable = set.kind === "team" && set.archivedAt === null && ready.access.canManagePermissions;

  return (
    <PermissionsPage
      title={teamRoles ? roleName(set, { shared: sharedRoles }) : set.name}
      back={back}
      caption={teamRoles ? `${roleKindLabel(set)}, ${allowedLabel}` : allowedLabel}
      action={removable ? <RemoveTeamPermissions ready={ready} set={set} teamRoles={teamRoles} sharedRoles={sharedRoles} /> : undefined}
      testId="permission-set"
    >
      {sharedCustom && set.archivedAt === null ? null : <AppliesTo ready={ready} set={set} teamRoles={teamRoles} />}
      <UnderlineTabs tabs={tabs} activeTab={tab} onChange={setTab} />
      {tab === "teams" ? (
        <div role="tabpanel" aria-label={t("denPermissions.setPage.tabTeams")}>
          <SharedRoleTeams ready={ready} set={set} />
        </div>
      ) : tab === "permissions" ? (
        <div role="tabpanel" aria-label="Permissions" className="flex flex-col gap-6">
          {sharedCustom && set.archivedAt === null ? <RoleNameField ready={ready} set={set} /> : null}
          {/* Remount when the saved state changes so the draft starts from it. */}
          <PermissionSetEditor key={set.permissions.map((state) => state.status).join("")} ready={ready} set={set} update={update} impact={impact} />
        </div>
      ) : (
        <div role="tabpanel" aria-label={t("denPermissions.setPage.tabHistory")}>
          <PermissionSetHistory ready={ready} setId={set.id} />
        </div>
      )}
    </PermissionsPage>
  );
}

function AppliesTo({ ready, set, teamRoles }: { ready: ReadyAccess; set: PermissionSetDetail; teamRoles: boolean }) {
  const t = useDenT();
  // teamRoles: Admin comes from a person's own role or from a team with the Admin role.
  const adminTeamsLabel = (count: number) => teamRoles
    ? t("denPermissions.setPage.adminRoleTeamCount", { count })
    : t("denPermissions.setPage.adminTeamCount", { count });
  const appliesTo = set.appliesTo;
  if (set.archivedAt) {
    return <DenNotice tone="neutral" icon={LockKeyhole} message={t("denPermissions.setPage.removedOn", { date: new Date(set.archivedAt).toLocaleDateString() })} />;
  }
  if (appliesTo.kind === "everyone") {
    return <p className="text-[13px] text-gray-600" data-testid="permission-set-applies-to">{t("denPermissions.setPage.appliesEveryone", { members: t("denShell.memberCount", { count: appliesTo.memberCount }) })}</p>;
  }
  if (appliesTo.kind === "admins") {
    const people = appliesTo.directAdmins;
    if (!people && appliesTo.adminTeams.length === 0) {
      return <p className="text-[13px] text-gray-600" data-testid="permission-set-applies-to">{t("denPermissions.setPage.appliesAdminsAnd", { admins: t("denCommon.count.admin", { count: appliesTo.directAdminCount }), teams: teamRoles ? t("denPermissions.setPage.noAdminRoleTeams") : t("denPermissions.setPage.noAdminTeams") })}</p>;
    }
    return (
      <details className="group text-[13px] text-gray-600" data-testid="permission-set-applies-to">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400">
          <ChevronRight className="size-3.5 text-gray-400 transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true" />
          {t("denPermissions.setPage.appliesAdminsAnd", { admins: t("denCommon.count.admin", { count: appliesTo.directAdminCount }), teams: adminTeamsLabel(appliesTo.adminTeams.length) })}
        </summary>
        <ul className="mt-2 flex flex-col gap-1 pl-5">
          {people?.map((person) => <li key={person.memberId}>{person.name} <span className="text-gray-500">{person.email}</span></li>)}
          {appliesTo.adminTeams.map((team) => (
            <li key={team.id}>
              {ready.access.canViewTeams ? <Link className="underline-offset-2 hover:underline" href={getTeamRoute(ready.orgSlug, team.id)}>{team.name}</Link> : team.name} {t("denCommon.word.team")} <span className="text-gray-500">{t("denShell.memberCount", { count: team.memberCount })}</span>
            </li>
          ))}
        </ul>
      </details>
    );
  }
  const team = appliesTo.team;
  const teamName = team?.name ?? t("denPermissions.list.deletedTeam");
  const members = appliesTo.members;
  if (!members) {
    return <p className="text-[13px] text-gray-600" data-testid="permission-set-applies-to">{t("denPermissions.setPage.appliesTeam", { team: teamName, members: t("denShell.memberCount", { count: appliesTo.memberCount }) })}</p>;
  }
  return (
    <details className="group text-[13px] text-gray-600" data-testid="permission-set-applies-to">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400">
        <ChevronRight className="size-3.5 text-gray-400 transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true" />
        {t("denPermissions.setPage.appliesTeam", { team: teamName, members: t("denShell.memberCount", { count: appliesTo.memberCount }) })}
      </summary>
      <ul className="mt-2 flex flex-col gap-1 pl-5">
        {members.length === 0 ? <li className="text-gray-500">{t("denPermissions.setPage.noTeamMembers")}</li> : null}
        {members.map((person) => <li key={person.memberId}>{person.name} <span className="text-gray-500">{person.email}</span></li>)}
        {team && ready.access.canViewTeams ? <li><Link className="underline-offset-2 hover:underline" href={getTeamRoute(ready.orgSlug, team.id)}>{t("denPermissions.setPage.openTeam", { team: teamName })}</Link></li> : null}
      </ul>
    </details>
  );
}

/** Why a key can't be changed in this set by this person, or null. */
function keyLockReason(ready: ReadyAccess, set: PermissionSetDetail, key: PermissionKey, saved: PermissionStatus, locked: boolean, t: DenTranslate): string | null {
  if (locked) return t("denPermissions.editor.alwaysOnForAdmins");
  if (saved === "allow" || ready.held.has(key)) return null;
  const defaultKey = set.kind === "member_default" ? "member" : set.kind === "admin_default" ? "admin" : null;
  // Re-allowing a key that is on by default in this default set is always allowed.
  if (defaultKey && getPermissionDefinition(key).defaultOn.includes(defaultKey)) return null;
  return t("denPermissions.editor.noPermission");
}

function setReadOnlyReason(ready: ReadyAccess, set: PermissionSetDetail, t: DenTranslate): string | null {
  if (set.archivedAt) return t("denPermissions.setPage.removedReadOnly");
  if (!ready.access.canManagePermissions) return `Read only. ${permissionLockReason("permissions.manage")}`;
  if (set.kind === "admin_default" && !ready.access.isAdmin) return t("denPermissions.setPage.adminOnlyReadOnly");
  return null;
}

function PermissionSetEditor({ ready, set, update, impact }: {
  ready: ReadyAccess;
  set: PermissionSetDetail;
  update: ReturnType<typeof useUpdatePermissionSet>;
  /** sharedRoles: who a save changes, e.g. "Updates Sales and Engineering, 9 people". */
  impact?: string;
}) {
  const t = useDenT();
  const [draft, setDraft] = useState<ReadonlyMap<string, PermissionStatus>>(new Map());
  const toast = useDenToast();
  const readOnlyReason = setReadOnlyReason(ready, set, t);

  const rows: PermissionEditorRow[] = set.permissions.flatMap((state) => {
    if (!isPermissionKey(state.key)) return [];
    return [{
      key: state.key,
      status: state.status,
      draft: draft.get(state.key) ?? state.status,
      lockedReason: keyLockReason(ready, set, state.key, state.status, state.locked, t),
    }];
  });
  const changes: PermissionChange[] = rows.filter((row) => row.draft !== row.status).map((row) => ({ key: row.key, status: row.draft }));

  function toggle(key: PermissionKey, next: PermissionStatus) {
    update.reset();
    setDraft((current) => {
      const saved = set.permissions.find((state) => state.key === key)?.status;
      const copy = new Map(current);
      if (next === saved) copy.delete(key);
      else copy.set(key, next);
      return copy;
    });
  }

  async function save(toSave: PermissionChange[], undoable: boolean) {
    await update.mutateAsync(toSave);
    const count = t("denCommon.count.change", { count: toSave.length });
    toast({
      title: undoable ? t("denPermissions.setPage.savedCount", { count }) : t("denPermissions.setPage.undidCount", { count }),
      action: undoable
        ? {
            label: t("denCommon.action.undo"),
            onClick: async () => {
              const inverse = toSave.map((change): PermissionChange => ({ key: change.key, status: change.status === "allow" ? "deny" : "allow" }));
              try {
                await save(inverse, false);
              } catch {
                return;
              }
            },
          }
        : undefined,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <PermissionEditor
        rows={rows}
        onToggle={toggle}
        readOnlyReasonId={readOnlyReason ? "permission-set-read-only" : undefined}
        beforeList={readOnlyReason ? <DenNotice tone="neutral" icon={LockKeyhole} message={<span id="permission-set-read-only">{readOnlyReason}</span>} /> : null}
      />
      {update.error ? <DenNotice tone="error" message={update.error.message} /> : null}
      {changes.length > 0 ? (
        <DenStickyActionBar
          testId="permission-set-save-bar"
          summary={impact ? <span className="flex flex-col"><span className="font-medium text-gray-900">{impact}</span><span>{t("denPermissions.setPage.unsavedChangeCount", { count: changes.length })}</span></span> : <span>{t("denPermissions.setPage.unsavedChangeCount", { count: changes.length })}</span>}
        >
          <DenButton variant="secondary" disabled={update.isPending} onClick={() => { update.reset(); setDraft(new Map()); }}>{t("denCommon.action.discard")}</DenButton>
          <DenButton loading={update.isPending} onClick={() => void save(changes, true).catch(() => undefined)}>{t("denPermissions.setPage.saveChanges")}</DenButton>
        </DenStickyActionBar>
      ) : null}
    </div>
  );
}

const SOURCE_LABELS: Record<Exclude<PermissionHistoryItem["source"], "user">, { allow: DenMessageKey; deny: DenMessageKey }> = {
  seed: { allow: "denPermissions.history.seedAllow", deny: "denPermissions.history.seedDeny" },
  reconcile: { allow: "denPermissions.history.reconcileAllow", deny: "denPermissions.history.reconcileDeny" },
  migration: { allow: "denPermissions.history.migrationAllow", deny: "denPermissions.history.migrationDeny" },
};

function HistorySentence({ item }: { item: PermissionHistoryItem }) {
  const t = useDenT();
  const label = item.label ?? t("denPermissions.history.missingLabel");
  if (item.source === "user") {
    const who = item.changedBy?.name ?? item.changedBy?.email ?? t("denPermissions.history.formerMember");
    return <><span className="font-medium text-gray-900">{who}</span> {item.status === "allow" ? t("denPermissions.history.verbAllowed") : t("denPermissions.history.verbRemoved")} <span className="font-medium text-gray-900">{label}</span></>;
  }
  return <><span className="font-medium text-gray-900">{label}</span> {t(SOURCE_LABELS[item.source][item.status])}</>;
}

function PermissionSetHistory({ ready, setId }: { ready: ReadyAccess; setId: string }) {
  const t = useDenT();
  const history = usePermissionSetHistory(ready.orgId, setId, true);
  const items = history.data?.pages.flatMap((page) => page.items) ?? [];

  if (history.isPending) return <PermissionRowsSkeleton rows={5} label={t("denPermissions.history.loading")} />;
  return (
    <div className="flex flex-col gap-3" data-testid="permission-set-history">
      {history.isError ? (
        <div className="flex flex-col items-start gap-2">
          <DenNotice tone="error" className="w-full" message={items.length > 0 ? t("denPermissions.history.moreError") : history.error instanceof Error ? history.error.message : t("denPermissions.history.loadError")} />
          <DenButton variant="secondary" size="sm" disabled={history.isFetching} onClick={() => void (history.isFetchNextPageError ? history.fetchNextPage() : history.refetch())}>{t("denCommon.action.tryAgain")}</DenButton>
        </div>
      ) : null}
      {items.length === 0 && !history.isError ? <p className="py-3 text-[13px] text-gray-500">{t("denPermissions.history.empty")}</p> : null}
      <ol className="flex flex-col [&>*]:border-b [&>*]:border-gray-100">
        {items.map((item) => (
          <li key={item.id} className="flex min-h-11 items-center gap-3 py-2" data-testid="permission-history-row" data-source={item.source} data-status={item.status}>
            <p className="min-w-0 flex-1 truncate text-[13px] text-gray-600"><HistorySentence item={item} /></p>
            <RelativeTime value={item.createdAt} />
          </li>
        ))}
      </ol>
      {history.hasNextPage ? (
        <DenButton variant="secondary" size="sm" className="w-fit" loading={history.isFetchingNextPage} onClick={() => void history.fetchNextPage()}>{t("denPermissions.history.showOlder")}</DenButton>
      ) : null}
    </div>
  );
}

function RemoveTeamPermissions({ ready, set, teamRoles, sharedRoles }: { ready: ReadyAccess; set: PermissionSetDetail; teamRoles: boolean; sharedRoles: boolean }) {
  const t = useDenT();
  const router = useRouter();
  const toast = useDenToast();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const remove = useRemoveTeamPermissions(ready.orgId, set.id);
  const teamName = set.team?.name ?? t("denPermissions.removeDialog.thisTeam");
  const sharedTeams = set.teams.map((team) => team.name ?? t("denPermissions.list.deletedTeam"));
  // sharedRoles: deleting a role takes it off every team; teamRoles: removing it leaves the team with Member.
  const words = sharedRoles
    ? {
        trigger: t("denPermissions.removeDialog.deleteRoleAction"),
        title: t("denPermissions.removeDialog.deleteRoleTitle", { name: set.name }),
        description: sharedTeams.length > 0
          ? t("denPermissions.removeDialog.roleLoss", { count: sharedTeams.length, teams: sharedTeams.join(", ") })
          : t("denPermissions.removeDialog.nobodyHasRole"),
        confirm: t("denPermissions.removeDialog.deleteRoleAction"),
        done: t("denPermissions.removeDialog.deletedRole", { name: set.name }),
      }
    : teamRoles
    ? {
        trigger: t("denPermissions.removeDialog.removeRoleAction"),
        title: t("denPermissions.removeDialog.removeRoleTitle", { team: teamName }),
        description: t("denPermissions.removeDialog.teamRoleLoss", { team: teamName, role: TEAM_ROLE_LABELS.member }),
        confirm: t("denPermissions.removeDialog.removeRoleAction"),
        done: t("denPermissions.removeDialog.teamRoleDone", { team: teamName, role: TEAM_ROLE_LABELS.member }),
      }
    : {
        trigger: t("denPermissions.removeDialog.removeAction"),
        title: t("denPermissions.removeDialog.removeTitle", { name: set.name }),
        description: t("denPermissions.removeDialog.teamLoss", { team: teamName }),
        confirm: t("denPermissions.removeDialog.removeConfirm"),
        done: t("denPermissions.removeDialog.removedSet", { name: set.name }),
      };

  async function confirm() {
    try {
      await remove.mutateAsync();
      setOpen(false);
      toast({ title: words.done });
      router.push(sharedRoles ? `${getMembersRoute(ready.orgSlug)}?tab=roles` : teamRoles && set.team ? getTeamRoute(ready.orgSlug, set.team.id) : getPermissionsRoute(ready.orgSlug));
    } catch {
      return;
    }
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => { if (!remove.isPending) { remove.reset(); setOpen(next); } }}>
      <AlertDialog.Trigger className={buttonVariants({ variant: "secondary", size: "sm" })} data-testid="remove-team-permissions">{words.trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-gray-950/45" />
        <AlertDialog.Popup data-testid="remove-team-permissions-dialog" initialFocus={cancelRef} className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[16px] border border-gray-200 bg-white p-5 outline-none">
          <AlertDialog.Title className="text-[15px] font-medium text-gray-950">{words.title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-[13px] leading-5 text-gray-600">
            {words.description}
          </AlertDialog.Description>
          {remove.error ? <DenNotice tone="error" className="mt-3" message={remove.error.message} /> : null}
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Close ref={cancelRef} disabled={remove.isPending} className={buttonVariants({ variant: "secondary" })}>{t("denCommon.action.cancel")}</AlertDialog.Close>
            <DenButton data-testid="remove-team-permissions-confirm" variant="destructive" loading={remove.isPending} onClick={() => void confirm()}>{words.confirm}</DenButton>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
