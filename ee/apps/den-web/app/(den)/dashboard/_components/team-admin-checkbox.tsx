"use client";

import { useState } from "react";
import { useDenT } from "../../../_lib/i18n/client";
import { DenNotice } from "../../_components/ui/notice";
import { getOrgAccessFlags, permissionLockReason, type DenOrgTeam } from "../../_lib/den-org";
import { useOrgDashboard } from "../_providers/org-dashboard-provider";

export function TeamAdminCheckbox({ team }: { team: DenOrgTeam }) {
  const t = useDenT();
  const { orgContext, updateTeam, mutationBusy } = useOrgDashboard();
  const [error, setError] = useState<string | null>(null);
  const canManageAdminTeams = orgContext && getOrgAccessFlags(orgContext.currentMember.role, orgContext.currentMember.isOwner, orgContext.currentMember.permissions).canManageAdminTeams;
  return (
    <div className="mt-3 grid gap-2 text-[13px]">
      <label className="flex items-start gap-2 text-gray-700">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={team.grantsOrganizationAdmin}
          disabled={!canManageAdminTeams || mutationBusy === "update-team"}
          onChange={async (event) => {
            setError(null);
            try {
              await updateTeam(team.id, { grantsOrganizationAdmin: event.target.checked });
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : t("denTeam.admin.updateError"));
            }
          }}
        />
        <span>{t("denTeam.admin.grantAll", { teamName: team.name })}</span>
      </label>
      <p className="text-[12px] text-gray-500">
        {canManageAdminTeams ? "" : t("denTeam.admin.lockedNotice", { reason: permissionLockReason("teams.manage_admin") })}
        {t("denTeam.admin.inheritedNote")}
        {team.managedByScim ? t("denTeam.admin.scimNote") : ""}
      </p>
      {error ? <DenNotice tone="error" message={error} /> : null}
    </div>
  );
}
