"use client";

import { useId, useState } from "react";
import { Globe, Info, Terminal, TriangleAlert, X } from "lucide-react";
import type { DesktopExecutionPolicy } from "@openwork/types/den/desktop-policies";
import { useDenT } from "../../../_lib/i18n/client";
import { DenButton } from "../../_components/ui/button";
import { validateExecutionPolicy } from "./execution-policy-fields";
import { TeamPermissionGroup, TeamPermissionSelect } from "./team-permission-fields";
import { teamWebsiteSummary } from "./team-permission-state";

export function TeamExecutionFields({ value, onChange, onPendingSiteChange }: {
  value: DesktopExecutionPolicy;
  onChange: (value: DesktopExecutionPolicy) => void;
  onPendingSiteChange: (pending: boolean) => void;
}) {
  const t = useDenT();
  const id = useId();
  const [site, setSite] = useState("");
  const [siteError, setSiteError] = useState<string | null>(null);
  const [editingSites, setEditingSites] = useState(false);
  const [commandsText, setCommandsText] = useState(value.blockedCommands.join("\n"));
  const browserMode = value.browserOrigins === undefined ? "all" : value.browserOrigins.length || editingSites ? "approved" : "blocked";
  const commandsAllowed = value.commands === "allow";
  const restrictedBrowser = value.browserOrigins !== undefined || value.blockBrowserUploads;
  const websiteSummary = teamWebsiteSummary(value);

  function changeSite(text: string) {
    setSite(text);
    setSiteError(null);
    onPendingSiteChange(Boolean(text.trim()));
  }

  function addSite() {
    try {
      const candidate = validateExecutionPolicy({ ...value, browserOrigins: [...(value.browserOrigins ?? []), site.trim()] });
      const origin = candidate.browserOrigins?.at(-1);
      if (origin && value.browserOrigins?.includes(origin)) {
        setSiteError(t("denTeam.execution.siteDuplicate"));
        return;
      }
      onChange(candidate);
      changeSite("");
    } catch (error) {
      setSiteError(error instanceof Error ? error.message : t("denTeam.execution.siteInvalid"));
    }
  }

  return <>
    <TeamPermissionGroup title={t("denTeam.execution.groupBrowserTitle")} icon={Globe} defaultOpen status={browserMode === "all" ? t("denTeam.execution.statusAllowed") : browserMode === "blocked" || value.browserOrigins?.length === 0 ? t("denTeam.execution.modeBlocked") : t("denTeam.execution.modeApproved")} description={value.browserOrigins?.length === 0 ? t("denTeam.execution.browserNoneApproved") : value.blockBrowserUploads ? t("denTeam.execution.uploadsBlocked", { summary: websiteSummary }) : t("denTeam.execution.uploadsAllowed", { summary: websiteSummary })}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 py-3">
        <label htmlFor={`${id}-browser`} className="text-sm text-gray-800">{t("denTeam.execution.websiteAccessLabel")}</label>
        <select id={`${id}-browser`} value={browserMode} onChange={(event) => {
          changeSite("");
          setEditingSites(event.target.value === "approved");
          if (event.target.value === "all") {
            const { browserOrigins: _origins, ...rest } = value;
            onChange(rest);
          } else onChange({ ...value, browserOrigins: event.target.value === "blocked" ? [] : value.browserOrigins ?? [] });
        }} className="max-w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800">
          <option value="all">{t("denTeam.execution.modeAll")}</option><option value="approved">{t("denTeam.execution.modeApproved")}</option><option value="blocked">{t("denTeam.execution.modeBlocked")}</option>
        </select>
      </div>
      {browserMode === "approved" ? <div className="pb-3">
        <ul aria-label={t("denTeam.execution.approvedListAria")} className="space-y-2">
          {value.browserOrigins?.map((origin) => <li key={origin} className="flex items-center gap-2 rounded-lg border border-gray-200 py-1 pl-3 pr-1">
            <span className="min-w-0 flex-1 break-all text-sm text-gray-700">{origin}</span>
            <DenButton variant="ghost" size="xs" aria-label={t("denTeam.execution.removeSiteAria", { origin })} onClick={() => { setEditingSites(true); setSiteError(null); onChange({ ...value, browserOrigins: value.browserOrigins?.filter((site) => site !== origin) }); }}><X aria-hidden="true" className="h-4 w-4" /></DenButton>
          </li>)}
        </ul>
        <div className="mt-2 flex gap-2">
          <input aria-label={t("denTeam.execution.siteInputAria")} aria-invalid={Boolean(siteError)} aria-describedby={`${id}-site-help${siteError ? ` ${id}-site-error` : ""}`} type="url" placeholder="https://portal.example.com" value={site} onChange={(event) => changeSite(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addSite(); } }} className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          <DenButton variant="secondary" size="sm" disabled={!site.trim()} onClick={addSite}>{t("denTeam.execution.addSite")}</DenButton>
        </div>
        {siteError ? <p id={`${id}-site-error`} role="alert" className="mt-2 text-xs text-red-700">{siteError}</p> : null}
        <p id={`${id}-site-help`} className="mt-2 text-xs leading-5 text-gray-500">{t("denTeam.execution.siteHelp")}{value.browserOrigins?.length === 0 ? t("denTeam.execution.noneApproved") : null}</p>
      </div> : null}
      <TeamPermissionSelect label={t("denTeam.execution.uploadsLabel")} allowed={!value.blockBrowserUploads} onChange={(allowed) => onChange({ ...value, blockBrowserUploads: !allowed })} />
      <div className="flex items-start gap-2 rounded-lg bg-gray-50 p-3 text-xs leading-5 text-gray-600"><Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--ow-warning)]" /><p>{t("denTeam.execution.browserScope")}{value.browserOrigins !== undefined ? t("denTeam.execution.browserToolsBlocked") : null}{t("denTeam.execution.browserScopeTail")}</p></div>
      {commandsAllowed && restrictedBrowser ? <div role="status" className="mt-3 flex items-start gap-2 rounded-lg border border-[var(--dls-border)] bg-[var(--dls-hover)] p-3 text-xs leading-5 text-[var(--dls-text-primary)]"><TriangleAlert aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--ow-warning)]" /><div><p>{t("denTeam.execution.commandWarning")}</p><DenButton variant="ghost" size="sm" className="mt-1 !px-0 !text-[var(--dls-text-primary)] underline underline-offset-4" onClick={() => onChange({ ...value, commands: "deny" })}>{t("denTeam.execution.blockCommands")}</DenButton></div></div> : null}
    </TeamPermissionGroup>
    <TeamPermissionGroup title={t("denTeam.execution.groupCommandsTitle")} icon={Terminal} status={!commandsAllowed ? t("denTeam.execution.modeBlocked") : value.blockedCommands.length ? t("denTeam.execution.statusSomeBlocked") : t("denTeam.execution.statusAllowed")} description={!commandsAllowed ? t("denTeam.execution.commandsUnavailable") : value.blockedCommands.length ? t("denTeam.execution.commandsPatternsApply") : t("denTeam.execution.commandsAll")}>
      <TeamPermissionSelect label={t("denTeam.execution.commandsLabel")} allowed={commandsAllowed} onChange={(allowed) => onChange({ ...value, commands: allowed ? "allow" : "deny" })} />
      {commandsAllowed ? <details className="mt-2"><summary className="cursor-pointer text-xs text-gray-600">{t("denTeam.execution.advancedSummary")}</summary><label htmlFor={`${id}-patterns`} className="mt-3 block text-sm text-gray-800">{t("denTeam.execution.patternsLabel")}</label><textarea id={`${id}-patterns`} rows={3} value={commandsText} onChange={(event) => { setCommandsText(event.target.value); onChange({ ...value, blockedCommands: event.target.value.split("\n").filter((line) => line.trim()) }); }} className="mt-2 w-full rounded-lg border border-gray-200 p-3 text-sm" /><p className="mt-2 text-xs leading-5 text-gray-500">{t("denTeam.execution.patternsHelp")}</p></details> : null}
    </TeamPermissionGroup>
  </>;
}
