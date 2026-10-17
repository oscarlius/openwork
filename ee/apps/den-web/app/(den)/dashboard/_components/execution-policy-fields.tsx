"use client";
import { useEffect, useState } from "react";
import { desktopExecutionPolicySchema, type DesktopExecutionPolicy } from "@openwork/types/den/desktop-policies";
import { useDenT } from "../../../_lib/i18n/client";

export function validateExecutionPolicy(value: DesktopExecutionPolicy): DesktopExecutionPolicy {
  const parsed = desktopExecutionPolicySchema.safeParse(value);
  if (parsed.success) return parsed.data;
  if (parsed.error.issues.some((issue) => issue.path[0] === "browserOrigins")) throw new Error("Enter complete website addresses, one per line, without paths or sign-in details. For example: https://portal.example.com");
  throw new Error("Check the blocked command patterns. Use up to 100 patterns, with no more than 500 characters each.");
}

export function ExecutionPolicyFields({ value, onChange, disabled }: { value: DesktopExecutionPolicy; onChange: (value: DesktopExecutionPolicy) => void; disabled?: boolean }) {
  const t = useDenT();
  const [commandsText, setCommandsText] = useState(value.blockedCommands.join("\n"));
  const [originsText, setOriginsText] = useState(value.browserOrigins?.join("\n") ?? "");
  useEffect(() => {
    setCommandsText((text) => JSON.stringify(text.split("\n").filter((line) => line.trim())) === JSON.stringify(value.blockedCommands) ? text : value.blockedCommands.join("\n"));
    if (value.browserOrigins !== undefined) {
      const origins = value.browserOrigins;
      setOriginsText((text) => JSON.stringify(text.split("\n").filter((line) => line.trim())) === JSON.stringify(origins) ? text : origins.join("\n"));
    }
  }, [value.blockedCommands, value.browserOrigins]);
  return <fieldset disabled={disabled} aria-label={t("denDesktopPolicies.execution.groupAria")} className="rounded-xl border border-gray-200 bg-white">
    <div className="border-b border-gray-100 px-4 py-3 text-sm font-medium text-gray-900">{t("denDesktopPolicies.execution.groupTitle")}</div>
    <div className="space-y-5 p-4">
      <label className="flex items-center justify-between gap-4 text-sm"><span>{t("denDesktopPolicies.execution.runCommandsLabel")}</span><input aria-label={t("denDesktopPolicies.execution.runCommandsLabel")} type="checkbox" checked={value.commands === "allow"} onChange={(event) => onChange({ ...value, commands: event.target.checked ? "allow" : "deny" })} /></label>
      <label className="block text-sm text-gray-800">{t("denTeam.execution.patternsLabel")}<textarea aria-label={t("denTeam.execution.patternsLabel")} disabled={value.commands === "deny"} className="mt-2 w-full rounded-lg border border-gray-200 p-3 text-sm" rows={2} value={commandsText} onChange={(event) => { setCommandsText(event.target.value); onChange({ ...value, blockedCommands: event.target.value.split("\n").filter((line) => line.trim()) }); }} /></label>
      <p className="text-xs text-gray-500">{t("denDesktopPolicies.execution.patternsHelp")}</p>
      <label className="flex items-center justify-between gap-4 text-sm"><span>{t("denDesktopPolicies.execution.restrictBrowsingLabel")}</span><input aria-label={t("denDesktopPolicies.execution.restrictBrowsingLabel")} type="checkbox" checked={value.browserOrigins !== undefined} onChange={(event) => { if (event.target.checked) onChange({ ...value, browserOrigins: originsText.split("\n").map((line) => line.trim()).filter(Boolean) }); else { const { browserOrigins: _origins, ...rest } = value; onChange(rest); } }} /></label>
      {value.browserOrigins !== undefined ? <label className="block text-sm text-gray-800">{t("denTeam.execution.approvedListAria")}<textarea aria-label={t("denTeam.execution.approvedListAria")} className="mt-2 w-full rounded-lg border border-gray-200 p-3 text-sm" rows={3} placeholder="https://portal.example.com" value={originsText} onChange={(event) => { setOriginsText(event.target.value); onChange({ ...value, browserOrigins: event.target.value.split("\n").filter((line) => line.trim()) }); }} /><span className="mt-1 block text-xs text-gray-500">{t("denDesktopPolicies.execution.approvedSitesHelp")}</span></label> : null}
      <label className="flex items-center justify-between gap-4 text-sm"><span>{t("denDesktopPolicies.execution.blockUploadsLabel")}</span><input aria-label={t("denDesktopPolicies.execution.blockUploadsLabel")} type="checkbox" checked={value.blockBrowserUploads} onChange={(event) => onChange({ ...value, blockBrowserUploads: event.target.checked })} /></label>
      <p className="text-xs text-gray-500">{t("denDesktopPolicies.execution.browserRulesHelp")}</p>
    </div>
  </fieldset>;
}
