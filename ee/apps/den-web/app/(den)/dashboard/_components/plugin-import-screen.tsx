"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, FileText, Github, Server } from "lucide-react";
import { DenButton } from "../../_components/ui/button";
import { DenInput } from "../../_components/ui/input";
import { DenSelect } from "../../_components/ui/select";
import { getRequestError, requestJson } from "../../_lib/den-flow";
import { getNewPluginRoute } from "../../_lib/den-org";
import { useDenT } from "../../../_lib/i18n/client";
import { type DenTranslate } from "../../../_lib/i18n/messages";
import { useOrgDashboard } from "../_providers/org-dashboard-provider";
import {
  normalizePublicGitHubPluginUrl,
  parsePluginImportPreview,
  pluginImportSourceLabel,
  savePluginImportDraft,
  type PluginImportAuthType,
  type PluginImportCredentialMode,
  type PluginImportPreview,
} from "./plugin-import-draft";

type PreviewItem = {
  detail: string;
  key: string;
  kind: "skill" | "mcp";
  name: string;
  status: string;
  supported: boolean;
};

function serverStatus(t: DenTranslate, preview: PluginImportPreview["servers"][number]): string {
  if (preview.reuseConnectionName) return t("denPlugin.import.usesExistingConnection", { name: preview.reuseConnectionName });
  if (preview.supported) return t("denPlugin.import.statusReady");
  if (preview.skippedReason === "native_connector") return t("denPlugin.import.connectInOpenWorkInstead", { name: preview.mapsToName ?? t("denPlugin.import.thisProvider") });
  if (preview.skippedReason === "local_unsupported") return t("denPlugin.import.desktopOnlyUnsupported");
  if (preview.skippedReason === "missing_url") return t("denPlugin.import.noRemoteUrl");
  if (preview.skippedReason === "headers_unsupported") return t("denPlugin.import.staticHeadersUnsupported");
  if (preview.skippedReason === "invalid_config") return t("denPlugin.import.invalidConfig");
  return t("denPlugin.import.statusUnsupported");
}

export function PluginImportScreen() {
  const t = useDenT();
  const router = useRouter();
  const { orgSlug, runReauthableAction } = useOrgDashboard();
  const [githubUrl, setGithubUrl] = useState("");
  const [preview, setPreview] = useState<PluginImportPreview | null>(null);
  const [selectedServerKeys, setSelectedServerKeys] = useState<string[]>([]);
  const [selectedSkillKeys, setSelectedSkillKeys] = useState<string[]>([]);
  const [authType, setAuthType] = useState<PluginImportAuthType>("oauth");
  const [credentialMode, setCredentialMode] = useState<PluginImportCredentialMode>("per_member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function previewImport() {
    if (!githubUrl.trim()) {
      setError(t("denPlugin.import.urlRequired"));
      return;
    }

    let normalizedGithubUrl: string;
    try {
      normalizedGithubUrl = normalizePublicGitHubPluginUrl(githubUrl);
    } catch (urlError) {
      setError(urlError instanceof Error ? urlError.message : t("denPlugin.import.urlInvalid"));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      let payload: unknown = null;
      await runReauthableAction("preview-github-plugin-components", async () => {
        const result = await requestJson(
          "/v1/plugins/import-mcps-from-github-url/preview",
          { method: "POST", body: JSON.stringify({ githubUrl: normalizedGithubUrl }) },
          20000,
        );
        if (!result.response.ok) {
          throw getRequestError(result.payload, result.response, t("denPlugin.import.previewFailed"));
        }
        payload = result.payload;
      });
      const nextPreview = parsePluginImportPreview(payload);
      setGithubUrl(normalizedGithubUrl);
      setPreview(nextPreview);
      setSelectedServerKeys(nextPreview.servers.filter((server) => server.supported).map((server) => server.serverKey));
      setSelectedSkillKeys(nextPreview.skills.filter((skill) => skill.supported).map((skill) => skill.skillKey));
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : t("denPlugin.import.previewFailed"));
    } finally {
      setBusy(false);
    }
  }

  function continueToCreate() {
    if (!preview || (selectedServerKeys.length === 0 && selectedSkillKeys.length === 0)) {
      setError(t("denPlugin.import.selectAtLeastOne"));
      return;
    }
    try {
      savePluginImportDraft({
        version: 1,
        authType,
        credentialMode,
        githubUrl,
        preview,
        selectedServerKeys,
        selectedSkillKeys,
      });
    } catch (draftError) {
      setError(draftError instanceof Error ? draftError.message : t("denPlugin.import.draftUnsafe"));
      return;
    }
    router.push(getNewPluginRoute(orgSlug));
  }

  const selectedMcpCount = selectedServerKeys.length;
  const selectedCount = selectedMcpCount + selectedSkillKeys.length;
  const previewItems: PreviewItem[] = preview
    ? [
        ...preview.skills.map((skill): PreviewItem => ({
          key: skill.skillKey,
          kind: "skill",
          name: skill.name,
          detail: skill.description ?? skill.sourcePath,
          supported: skill.supported,
          status: skill.supported ? t("denPlugin.import.statusReady") : t("denPlugin.import.unsupportedSkill"),
        })),
        ...preview.servers.map((server): PreviewItem => ({
          key: server.serverKey,
          kind: "mcp",
          name: server.name,
          detail: server.url ?? t("denPlugin.import.noRemoteUrlShort"),
          supported: server.supported,
          status: serverStatus(t, server),
        })),
      ]
    : [];

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <Link
        href={getNewPluginRoute(orgSlug)}
        className="mb-6 inline-flex items-center gap-2 text-[14px] text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft size={15} />
        {t("denPlugin.import.backToCreate")}
      </Link>

      <div className="flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gray-900 text-white">
          <Github size={20} />
        </div>
        <div>
          <h1 className="text-[28px] font-semibold text-gray-900">{t("denPlugin.import.title")}</h1>
          <p className="mt-1 text-[15px] text-gray-500">
            {t("denPlugin.import.subtitle")}
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-[24px] border border-gray-200 bg-white p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1">
            <span className="mb-1.5 block text-[13px] font-medium text-gray-700">{t("denPlugin.import.urlLabel")}</span>
            <DenInput
              value={githubUrl}
              onChange={(event) => {
                setGithubUrl(event.target.value);
                setPreview(null);
                setSelectedServerKeys([]);
                setSelectedSkillKeys([]);
                setError(null);
              }}
              placeholder="https://github.com/anthropics/knowledge-work-plugins/tree/main/sales"
              disabled={busy}
            />
          </label>
          <DenButton onClick={() => void previewImport()} disabled={busy || !githubUrl.trim()}>
            {busy ? t("denPlugin.import.previewing") : t("denPlugin.import.preview")}
          </DenButton>
        </div>
        <p className="mt-2 text-[12px] text-gray-500">{t("denPlugin.import.publicOnly")}</p>
      </div>

      {preview ? (
        <div className="mt-6 rounded-[24px] border border-gray-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">{t("denPlugin.import.preview")}</p>
              <h2 className="mt-1 text-[18px] font-semibold text-gray-900">{pluginImportSourceLabel(preview)}</h2>
              <p className="mt-1 text-[13px] text-gray-500">{t("denPlugin.import.chooseComponents")}</p>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-[12px] font-medium text-gray-600">
              {t("denPlugin.import.selectedCount", { count: selectedCount })}
            </span>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-gray-100">
            {previewItems.map((item) => {
              const selected = item.kind === "mcp"
                ? selectedServerKeys.includes(item.key)
                : selectedSkillKeys.includes(item.key);
              const Icon = item.kind === "mcp" ? Server : FileText;
              return (
                <label key={`${item.kind}:${item.key}`} className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0">
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={!item.supported || busy}
                    onChange={(event) => {
                      const setter = item.kind === "mcp" ? setSelectedServerKeys : setSelectedSkillKeys;
                      setter((current) => event.target.checked
                        ? [...new Set([...current, item.key])]
                        : current.filter((key) => key !== item.key));
                    }}
                  />
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-500">
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-gray-900">{item.name}</span>
                    <span className="block truncate text-[12px] text-gray-500" title={item.detail}>{item.detail}</span>
                  </span>
                  <span className={`shrink-0 text-[12px] ${item.supported ? "text-emerald-600" : "text-amber-700"}`}>
                    {item.status}
                  </span>
                </label>
              );
            })}
          </div>

          {selectedMcpCount > 0 ? (
            <div className="mt-5 grid gap-3 rounded-2xl bg-gray-50 p-4 sm:grid-cols-2">
              <label>
                <span className="mb-1.5 block text-[13px] font-medium text-gray-700">{t("denPlugin.import.mcpAuth")}</span>
                <DenSelect value={authType} onChange={(event) => setAuthType(event.target.value === "none" ? "none" : "oauth")}>
                  <option value="oauth">OAuth</option>
                  <option value="none">{t("denPlugin.import.noAuth")}</option>
                </DenSelect>
              </label>
              <label>
                <span className="mb-1.5 block text-[13px] font-medium text-gray-700">{t("denPlugin.import.accountType")}</span>
                <DenSelect
                  value={credentialMode}
                  disabled={authType === "none"}
                  onChange={(event) => setCredentialMode(event.target.value === "shared" ? "shared" : "per_member")}
                >
                  <option value="per_member">{t("denPlugin.import.individualAccounts")}</option>
                  <option value="shared">{t("denPlugin.import.sharedOrgAccount")}</option>
                </DenSelect>
              </label>
            </div>
          ) : null}

          {preview.warnings.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-[var(--dls-border)] bg-[var(--dls-hover)] px-4 py-3 text-[13px] text-[var(--dls-text-primary)]">
              {preview.warnings.join(" ")}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-6 flex items-center justify-end gap-3">
        <Link href={getNewPluginRoute(orgSlug)} className="text-[14px] text-gray-500 hover:text-gray-900">
          {t("denPlugin.action.cancel")}
        </Link>
        <DenButton onClick={continueToCreate} disabled={!preview || selectedCount === 0 || busy}>
          {t("denPlugin.import.continueToCreate")}
          <ArrowRight size={15} />
        </DenButton>
      </div>
    </div>
  );
}
