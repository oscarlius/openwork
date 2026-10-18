"use client";

import { Globe, Users } from "lucide-react";
import { useMemo } from "react";
import { DenSwitch } from "../../_components/ui/switch";
import { permissionLockReason, type DenOrgMember, type DenOrgTeam } from "../../_lib/den-org";
import { useDenT } from "../../../_lib/i18n/client";
import { AccessRow as Row, AddPicker, Avatar, IconTile, RemoveButton } from "./access-rows";
import { type AccessDraft } from "./access-summary";

/**
 * The one Who can use it block. It edits a draft; each surface decides when
 * to save (a Share page saves on its footer button, Manage pages save on add
 * and remove).
 */
export function WhoCanUseIt({
  value,
  onChange,
  members,
  teams,
  owner,
  canShareWithEveryone,
  everyoneOffDescription,
  disabled = false,
}: {
  value: AccessDraft;
  onChange: (next: AccessDraft) => void;
  members: readonly DenOrgMember[];
  teams: readonly DenOrgTeam[];
  owner: { id: string; name: string; isYou: boolean } | null;
  canShareWithEveryone: boolean;
  everyoneOffDescription?: string;
  disabled?: boolean;
}) {
  const t = useDenT();
  const people = useMemo(
    () => value.memberIds
      .filter((id) => id !== owner?.id)
      .flatMap((id) => {
        const member = members.find((entry) => entry.id === id);
        return member ? [member] : [];
      }),
    [members, owner?.id, value.memberIds],
  );
  const addedTeams = useMemo(
    () => value.teamIds.flatMap((id) => {
      const team = teams.find((entry) => entry.id === id);
      return team ? [team] : [];
    }),
    [teams, value.teamIds],
  );
  const personOptions = members
    .filter((member) => member.id !== owner?.id && !value.memberIds.includes(member.id) && member.userId)
    .map((member) => ({ id: member.id, name: member.user.name || member.user.email, detail: member.user.email }));
  const teamOptions = teams
    .filter((team) => !value.teamIds.includes(team.id))
    .map((team) => ({ id: team.id, name: team.name, detail: t("denCommon.count.people", { count: team.memberIds.length }) }));

  const everyoneDescription = value.orgWide
    ? t("denPluginAccess.block.onDescription")
    : canShareWithEveryone ? (everyoneOffDescription ?? t("denPluginAccess.block.offDescription")) : permissionLockReason("sharing.share_org_wide");

  return (
    <div className="flex flex-col divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white" data-testid="who-can-use-it">
      <Row
        lead={<IconTile icon={Globe} />}
        title={t("denInference.editor.everyoneInOrg")}
        description={everyoneDescription}
        trailing={(
          <DenSwitch
            checked={value.orgWide}
            disabled={disabled || (!canShareWithEveryone && !value.orgWide)}
            onChange={(orgWide) => onChange({ ...value, orgWide })}
            aria-label={t("denInference.editor.everyoneInOrg")}
            testId="access-everyone"
          />
        )}
      />
      {owner ? (
        <Row
          lead={<Avatar name={owner.name} owner />}
          title={owner.isYou ? t("denPluginAccess.block.ownerIsYou", { name: owner.name }) : owner.name}
          description={t("denPluginAccess.block.ownerCanChange")}
          trailing={<span className="shrink-0 text-[12px] text-gray-500">{t("denSetup.claim.factOwner")}</span>}
          testId="access-owner"
        />
      ) : null}
      {value.orgWide ? null : (
        <>
          {people.map((member) => (
            <Row
              key={member.id}
              lead={<Avatar name={member.user.name || member.user.email} />}
              title={member.user.name || member.user.email}
              description={member.user.email}
              trailing={<RemoveButton label={t("denPluginAccess.block.removeGrant", { name: member.user.name || member.user.email })} disabled={disabled} onClick={() => onChange({ ...value, memberIds: value.memberIds.filter((id) => id !== member.id) })} />}
              testId="access-person"
            />
          ))}
          {addedTeams.map((team) => (
            <Row
              key={team.id}
              lead={<IconTile icon={Users} />}
              title={team.name}
              description={t("denPluginAccess.block.teamMembersLater", { people: t("denCommon.count.people", { count: team.memberIds.length }) })}
              trailing={<RemoveButton label={t("denPluginAccess.block.removeGrant", { name: team.name })} disabled={disabled} onClick={() => onChange({ ...value, teamIds: value.teamIds.filter((id) => id !== team.id) })} />}
              testId="access-team"
            />
          ))}
          <div className="flex flex-wrap items-center gap-2 px-5 py-3">
            <AddPicker
              kind="person"
              options={personOptions}
              disabled={disabled}
              onAdd={(ids) => onChange({ ...value, memberIds: [...value.memberIds, ...ids] })}
            />
            <AddPicker
              kind="team"
              options={teamOptions}
              disabled={disabled}
              onAdd={(ids) => onChange({ ...value, teamIds: [...value.teamIds, ...ids] })}
            />
          </div>
        </>
      )}
    </div>
  );
}
