/** @jsxImportSource react */
import { useState, type ComponentProps, type ReactNode } from "react";
import { Cpu, RefreshCcw, Server } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { OpenworkServerClient, OpenworkCloudMcpHealth, OpenworkRuntimeConfigStatus } from "@/app/lib/openwork-server";
import { sanitizeCloudMcpHealthDiagnostic, sanitizeDiagnosticRecord } from "@/app/lib/diagnostic-sanitizer";
import {
  DEFAULT_DEN_API_BASE_URL,
  DEFAULT_DEN_BASE_URL,
  readDenBootstrapConfig,
  readDenSettings,
} from "@/app/lib/den";
import {
  describeCloudMcpTarget,
  describeDenEndpointSource,
  type DenEndpointSource,
} from "@/app/lib/den-endpoint-sources";
import { useOpencodeEngineControls } from "@/react-app/shell/opencode-engine-controls";
import { showEngineMigrationProgress } from "@/react-app/shell/engine-migration";
import { isDesktopRuntime } from "@/app/utils";
import { t } from "@/i18n";
import { ControlPlaneUrlEditor } from "../cloud/control-plane-url-editor";
import { usePlatform } from "../../../kernel/platform";
import { useFeatureFlagsPreferences } from "../state/feature-flags-preferences";
import { useDesktopRestriction } from "../../cloud/desktop-config-provider";
import {
  displayCustomControlPlaneUrl,
  isValidControlPlaneUrl,
} from "../cloud/control-plane-url";
import {
  SettingsInset,
  SettingsNotice,
  SettingsStatusBadge,
} from "../settings-section";
import {
  LayoutSection,
  LayoutSectionDescription,
  LayoutSectionHeader,
  LayoutSectionItem,
  LayoutSectionItemDescription,
  LayoutSectionItemFootnote,
  LayoutSectionItemHeader,
  LayoutSectionItemHeaderActions,
  LayoutSectionItemTitle,
  LayoutSectionTitle,
} from "../settings-layout";

type SettingsTone = ComponentProps<typeof SettingsStatusBadge>["tone"];

const DESKTOP_BOOTSTRAP_PATH_HINT = "~/.config/openwork/desktop-bootstrap.json";

function sourceBadgeLabel(source: DenEndpointSource): string {
  switch (source) {
    case "custom":
      return t("settings.server_endpoints_source_custom");
    case "bootstrap":
      return t("settings.server_endpoints_source_bootstrap");
    case "default":
      return t("settings.server_endpoints_source_default");
  }
}

function sourceBadgeClass(source: DenEndpointSource): string {
  switch (source) {
    case "custom":
      return "border-blue-7/40 bg-blue-3 text-blue-11";
    case "bootstrap":
      return "border-amber-7/40 bg-amber-3 text-amber-11";
    case "default":
      return "border-gray-7/50 bg-gray-3 text-gray-11";
  }
}

function EndpointSourceBadge(props: { source: DenEndpointSource }) {
  return (
    <Badge variant="outline" className={sourceBadgeClass(props.source)}>
      {sourceBadgeLabel(props.source)}
    </Badge>
  );
}

function EndpointWarningBadge(props: { children: ReactNode }) {
  return (
    <Badge variant="outline" className="border-amber-7/40 bg-amber-3 text-amber-11">
      {props.children}
    </Badge>
  );
}

function EndpointRow(props: { label: string; value: string; children?: ReactNode }) {
  return (
    <div className="grid gap-1 rounded-xl border border-gray-6/50 bg-gray-1/60 p-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-gray-9">
        {props.label}
      </div>
      <div className="min-w-0 space-y-2">
        <div className="truncate font-mono text-xs text-gray-12" title={props.value}>
          {props.value}
        </div>
        {props.children ? <div className="flex flex-wrap gap-1.5">{props.children}</div> : null}
      </div>
    </div>
  );
}

function bootstrapValueWhenNotDefault(value: string, buildDefault: string): string | null {
  const fallback = describeDenEndpointSource({
    storedValue: null,
    bootstrapValue: null,
    buildDefault,
  });
  return value === fallback.effective ? null : value;
}

function ServerEndpointsCard(props: { cloudMcpUrl: string | null }) {
  const settings = readDenSettings();
  const effectiveApiBaseUrl = settings.apiBaseUrl ?? DEFAULT_DEN_API_BASE_URL;
  const bootstrap = readDenBootstrapConfig();
  const organizationServer = describeDenEndpointSource({
    storedValue: null,
    bootstrapValue: bootstrapValueWhenNotDefault(bootstrap.baseUrl, DEFAULT_DEN_BASE_URL),
    buildDefault: DEFAULT_DEN_BASE_URL,
  });
  const apiEndpoint = describeDenEndpointSource({
    storedValue: null,
    bootstrapValue: bootstrapValueWhenNotDefault(bootstrap.apiBaseUrl, DEFAULT_DEN_API_BASE_URL),
    buildDefault: DEFAULT_DEN_API_BASE_URL,
  });
  const cloudMcp = describeCloudMcpTarget({
    mcpUrl: props.cloudMcpUrl,
    effectiveApiBaseUrl,
  });
  const hasBootstrapSource = organizationServer.source === "bootstrap" || apiEndpoint.source === "bootstrap";

  return (
    <SettingsInset className="space-y-3 bg-gray-1/40">
      <div className="space-y-1">
        <div className="text-sm font-medium text-gray-12">{t("settings.server_endpoints_title")}</div>
        <div className="text-xs text-gray-9">{t("settings.server_endpoints_desc")}</div>
      </div>

      <div className="space-y-2">
        <EndpointRow label={t("settings.server_endpoints_org")} value={settings.baseUrl}>
          <EndpointSourceBadge source={organizationServer.source} />
        </EndpointRow>
        <EndpointRow label={t("settings.server_endpoints_api")} value={effectiveApiBaseUrl}>
          <EndpointSourceBadge source={apiEndpoint.source} />
        </EndpointRow>
        <EndpointRow
          label={t("settings.server_endpoints_cloud_mcp")}
          value={cloudMcp.url ?? t("settings.server_endpoints_not_configured")}
        >
          {cloudMcp.url && cloudMcp.isLocalhost ? (
            <EndpointWarningBadge>{t("settings.server_endpoints_local_dev")}</EndpointWarningBadge>
          ) : null}
          {cloudMcp.url && !cloudMcp.matchesApi ? (
            <EndpointWarningBadge>{t("settings.server_endpoints_mismatch")}</EndpointWarningBadge>
          ) : null}
        </EndpointRow>
      </div>

      {hasBootstrapSource ? (
        <div className="text-[11px] text-amber-11">
          {t("settings.server_endpoints_bootstrap_hint", { path: DESKTOP_BOOTSTRAP_PATH_HINT })}
        </div>
      ) : null}
    </SettingsInset>
  );
}

interface AdvancedOrganizationServerSectionProps {
  authBusy: boolean;
  baseUrl: string;
  baseUrlBusy: boolean;
  baseUrlDraft: string;
  baseUrlError: string | null;
  onApplyBaseUrl: () => void | Promise<void>;
  onBaseUrlDraftChange: (value: string) => void;
  onClearServerConfiguration: () => void | Promise<void>;
  onResetBaseUrlToDefault: () => void | Promise<void>;
  sessionBusy: boolean;
  cloudMcpUrl: string | null;
}

export function AdvancedOrganizationServerSection(props: AdvancedOrganizationServerSectionProps) {
  const platform = usePlatform();
  const [clearConfirming, setClearConfirming] = useState(false);
  const controlsDisabled = [props.authBusy, props.baseUrlBusy, props.sessionBusy].some(Boolean);
  const customUrl = displayCustomControlPlaneUrl(props.baseUrlDraft);
  const currentUrl = displayCustomControlPlaneUrl(props.baseUrl);
  const clearServerConfiguration = () => {
    if (!clearConfirming) {
      setClearConfirming(true);
      return;
    }
    setClearConfirming(false);
    void props.onClearServerConfiguration();
  };

  return (
    <LayoutSection id="advanced-organization-server">
      <LayoutSectionHeader>
        <LayoutSectionTitle>{t("settings.organization_server_title")}</LayoutSectionTitle>
        <LayoutSectionDescription>{t("settings.organization_server_desc")}</LayoutSectionDescription>
      </LayoutSectionHeader>

      <LayoutSectionItem>
        <ControlPlaneUrlEditor
          disabled={controlsDisabled}
          hint={t("settings.organization_server_url_hint")}
          label={t("settings.organization_server_url_label")}
          onReset={props.onResetBaseUrlToDefault}
          onSave={props.onApplyBaseUrl}
          onValueChange={props.onBaseUrlDraftChange}
          placeholder={DEFAULT_DEN_BASE_URL}
          resetLabel={t("common.reset")}
          saveDisabled={!isValidControlPlaneUrl(customUrl)}
          saveLabel={t("common.save")}
          value={customUrl}
        />
        <LayoutSectionItemFootnote>
          {currentUrl
            ? t("settings.organization_server_current", { url: currentUrl })
            : t("settings.organization_server_default")}
        </LayoutSectionItemFootnote>
        {isDesktopRuntime() ? <ServerEndpointsCard cloudMcpUrl={props.cloudMcpUrl} /> : null}
        {platform.capabilities.desktopBootstrap ? (
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-9">
            <Button
              variant={clearConfirming ? "destructive" : "outline"}
              size="sm"
              onClick={clearServerConfiguration}
              disabled={controlsDisabled}
            >
              {clearConfirming
                ? t("den.cloud_control_plane_clear_confirm")
                : t("den.cloud_control_plane_clear")}
            </Button>
            <span>
              {clearConfirming
                ? t("den.cloud_control_plane_clear_confirm_hint")
                : t("den.cloud_control_plane_clear_hint")}
            </span>
          </div>
        ) : null}
        {props.baseUrlError ? <SettingsNotice tone="error">{props.baseUrlError}</SettingsNotice> : null}
      </LayoutSectionItem>
    </LayoutSection>
  );
}

interface RuntimeStatusCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  statusLabel: string;
  tone: SettingsTone;
  detailLines?: string[];
}

function RuntimeStatusCard(props: RuntimeStatusCardProps) {
  return (
    <SettingsInset className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-gray-6/60 bg-gray-1/70 text-gray-12">
          {props.icon}
        </div>
        <div>
          <div className="text-sm font-medium text-gray-12">{props.title}</div>
          <div className="text-xs text-gray-9">{props.description}</div>
        </div>
      </div>
      <SettingsStatusBadge className="inline-flex min-h-0 justify-start px-0 py-0" tone={props.tone} label={props.statusLabel} />
      {props.detailLines?.length ? (
        <div className="space-y-1 border-t border-gray-6/50 pt-2 text-[11px] text-gray-9">
          {props.detailLines.map((line) => (
            <div key={line} className="truncate" title={line}>
              {line}
            </div>
          ))}
        </div>
      ) : null}
    </SettingsInset>
  );
}

interface AdvancedRuntimeSectionProps {
  clientStatusLabel: string;
  clientTone: SettingsTone;
  clientDetailLines: string[];
  openworkStatusLabel: string;
  openworkTone: SettingsTone;
  openworkDetailLines: string[];
}

export function AdvancedRuntimeSection(props: AdvancedRuntimeSectionProps) {
  return (
    <LayoutSection id="advanced-runtime">
      <LayoutSectionHeader>
        <LayoutSectionTitle>{t("settings.runtime_title")}</LayoutSectionTitle>
        <LayoutSectionDescription>{t("settings.runtime_desc")}</LayoutSectionDescription>
      </LayoutSectionHeader>

      <div className="grid gap-3 sm:grid-cols-2">
        <RuntimeStatusCard
          icon={<Cpu size={18} />}
          title={t("settings.opencode_engine_label")}
          description={t("settings.opencode_engine_desc")}
          statusLabel={props.clientStatusLabel}
          tone={props.clientTone}
          detailLines={props.clientDetailLines}
        />
        <RuntimeStatusCard
          icon={<Server size={18} />}
          title={t("settings.openwork_server_label")}
          description={t("settings.openwork_server_desc")}
          statusLabel={props.openworkStatusLabel}
          tone={props.openworkTone}
          detailLines={props.openworkDetailLines}
        />
      </div>
    </LayoutSection>
  );
}

function DiagnosticRow(props: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-lg border border-gray-6 bg-gray-2/50 p-2 sm:grid-cols-[12rem_minmax(0,1fr)]">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-8">{props.label}</div>
      <div className="min-w-0 break-all font-mono text-[11px] text-gray-12">{props.value}</div>
    </div>
  );
}

function joinList(values: string[]): string {
  return values.length ? values.join(", ") : t("connect.diagnostics_none");
}

/** Joins the labelled clauses of a diagnostic value string, skipping the absent ones. */
function joinParts(parts: Array<string | null | false | undefined>): string {
  return parts.filter((part): part is string => Boolean(part)).join("; ");
}

function formatMaybe(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined || value === "") return t("common.unknown");
  return String(value);
}

function formatMetadataRecord(value: Record<string, string | number | boolean | null> | null | undefined): string {
  if (!value || Object.keys(value).length === 0) return t("connect.diagnostics_none");
  return Object.entries(value).map(([key, nested]) => `${key}=${formatMaybe(nested)}`).join(", ");
}

function formatSupportedFeatures(features: OpenworkCloudMcpHealth["compatibility"]["supportedFeatures"]): string {
  return Object.entries(features).map(([key, enabled]) => `${key}:${enabled ? t("connect.diagnostics_yes") : t("connect.diagnostics_no")}`).join(", ");
}

function formatPluginHashes(hashes: OpenworkCloudMcpHealth["compatibility"]["pluginFileHashes"]): string {
  if (hashes.length === 0) return t("connect.diagnostics_none");
  return hashes.map((hash) => `${hash.name}=${hash.sha256 ? hash.sha256.slice(0, 12) : `${t("config.unavailable")}${hash.error ? ` (${hash.error})` : ""}`}`).join(", ");
}

function formatMcpToolExposure(input: { checked: boolean; includesMcpTools: boolean | null; present: string[]; missing: string[]; limitation?: string }): string {
  if (!input.checked) return t("updates.not_checked");
  const includes = input.includesMcpTools === null
    ? t("common.unknown")
    : input.includesMcpTools
      ? t("connect.diagnostics_yes")
      : t("connect.diagnostics_no");
  return joinParts([
    `${t("settings.diag_includes_mcp_tools")}: ${includes}`,
    `${t("connect.diagnostics_agent_state_present")} ${joinList(input.present)}`,
    `${t("connect.diagnostics_agent_state_missing")} ${joinList(input.missing)}`,
    input.limitation ? `${t("settings.diag_limitation")}: ${input.limitation}` : null,
  ]);
}

interface AdvancedCloudMcpDiagnosticsSectionProps {
  cloudMcpHealth: OpenworkCloudMcpHealth | null;
  onRefresh: () => Promise<OpenworkCloudMcpHealth | null>;
}

export function AdvancedCloudMcpDiagnosticsSection(props: AdvancedCloudMcpDiagnosticsSectionProps) {
  const [busy, setBusy] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const safeHealth = sanitizeCloudMcpHealthDiagnostic(props.cloudMcpHealth);
  const projection = props.cloudMcpHealth?.tools.providerProjection;
  const compatibility = props.cloudMcpHealth?.compatibility;

  const refresh = async () => {
    setBusy(true);
    setCopyStatus(null);
    setRefreshError(null);
    try {
      await props.onRefresh();
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : t("settings.cloud_mcp_refresh_failed"));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    const payload = JSON.stringify({ cloudMcpHealth: safeHealth }, null, 2);
    await navigator.clipboard.writeText(payload);
    setCopyStatus(t("settings.cloud_mcp_copied"));
  };

  return (
    <LayoutSection id="advanced-agent-access">
      <LayoutSectionHeader>
        <LayoutSectionTitle>{t("settings.cloud_mcp_title")}</LayoutSectionTitle>
        <LayoutSectionDescription>
          {t("settings.cloud_mcp_desc")}
        </LayoutSectionDescription>
      </LayoutSectionHeader>

      <LayoutSectionItem>
        <LayoutSectionItemHeader>
          <LayoutSectionItemTitle>{t("settings.cloud_mcp_health_title")}</LayoutSectionItemTitle>
          <LayoutSectionItemDescription>
            {t("settings.cloud_mcp_health_desc")}
          </LayoutSectionItemDescription>
          <LayoutSectionItemHeaderActions>
            <Button type="button" variant="outline" size="sm" onClick={() => void refresh()} disabled={busy}>
              <RefreshCcw size={14} className={busy ? "animate-spin" : ""} />
              {t("common.refresh")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void copy()} disabled={!props.cloudMcpHealth}>
              {t("settings.cloud_mcp_copy_button")}
            </Button>
          </LayoutSectionItemHeaderActions>
        </LayoutSectionItemHeader>

        {copyStatus ? <SettingsNotice>{copyStatus}</SettingsNotice> : null}
        {refreshError ? <SettingsNotice tone="error">{refreshError}</SettingsNotice> : null}
        {props.cloudMcpHealth ? (
          <div className="space-y-2 rounded-xl border border-gray-6 bg-gray-1/60 p-3">
            <div className="grid gap-2">
              <DiagnosticRow
                label={t("settings.cloud_mcp_active_workspace")}
                value={`${props.cloudMcpHealth.workspace.id} (${props.cloudMcpHealth.workspace.directory ?? t("settings.diag_no_directory")})`}
              />
              <DiagnosticRow label={t("settings.cloud_mcp_desired_revision")} value={props.cloudMcpHealth.desired.revision ?? t("connect.diagnostics_none")} />
              <DiagnosticRow label={t("settings.cloud_mcp_applied_revision")} value={props.cloudMcpHealth.delivery.appliedRevision ?? t("connect.diagnostics_none")} />
              <DiagnosticRow label={t("settings.cloud_mcp_delivery")} value={`${props.cloudMcpHealth.delivery.state}${props.cloudMcpHealth.delivery.trigger ? ` / ${props.cloudMcpHealth.delivery.trigger}` : ""}`} />
              <DiagnosticRow label={t("settings.cloud_mcp_engine_status")} value={props.cloudMcpHealth.engine.status} />
              {props.cloudMcpHealth.engineInspection?.checked ? (
                <DiagnosticRow
                  label={t("settings.cloud_mcp_engine_mcp_servers")}
                  value={(props.cloudMcpHealth.engineInspection.servers ?? []).length
                    ? (props.cloudMcpHealth.engineInspection.servers ?? []).map((server) => `${server.name} ${server.status}${server.error ? ` (${server.error})` : ""}`).join("; ")
                    : t("settings.diag_none_tracked")}
                />
              ) : null}
              <DiagnosticRow
                label={t("settings.cloud_mcp_provider_model")}
                value={projection?.checked
                  ? joinParts([
                      `${projection.provider ?? t("common.unknown")}/${projection.model ?? t("common.unknown")}`,
                      `${t("settings.diag_source")} ${projection.source ?? t("common.unknown")}`,
                      `${t("settings.diag_tool_calling")} ${formatMaybe(projection.toolCalling)}`,
                      `${t("connect.diagnostics_agent_state_present")} ${joinList(projection.present)}`,
                      `${t("connect.diagnostics_agent_state_missing")} ${joinList(projection.missing)}`,
                      projection.limitation ? `${t("settings.diag_limitation")}: ${projection.limitation}` : null,
                    ])
                  : t("updates.not_checked")}
              />
              <DiagnosticRow
                label={t("settings.cloud_mcp_cloud_tools")}
                value={`${t("connect.diagnostics_evidence_derived")} ${t("connect.diagnostics_agent_state_present")} ${joinList(props.cloudMcpHealth.tools.present)}; ${t("connect.diagnostics_agent_state_missing")} ${joinList(props.cloudMcpHealth.tools.missing)}`}
              />
              <DiagnosticRow
                label={t("settings.cloud_mcp_direct_tools_list")}
                value={`${t("status.cap_past_check")} ${props.cloudMcpHealth.tools.direct.checked ? t("connect.diagnostics_yes") : t("connect.diagnostics_no")}; ${t("connect.diagnostics_agent_state_present")} ${joinList(props.cloudMcpHealth.tools.direct.present)}; ${t("connect.diagnostics_agent_state_missing")} ${joinList(props.cloudMcpHealth.tools.direct.missing)}`}
              />
              {props.cloudMcpHealth.tools.direct.trace ? (
                <DiagnosticRow
                  label={t("settings.cloud_mcp_direct_probe")}
                  value={[
                    props.cloudMcpHealth.tools.direct.trace.endpoint ?? t("settings.diag_unknown_endpoint"),
                    `${props.cloudMcpHealth.tools.direct.trace.latencyMs} ms`,
                    props.cloudMcpHealth.tools.direct.trace.steps.map((step) => `${step.step} ${step.ok ? t("settings.diag_step_ok") : t("connect.diagnostics_status_failed")}${step.httpStatus !== undefined ? ` (HTTP ${step.httpStatus})` : ""} ${Math.max(0, Math.round(step.latencyMs))}ms`).join(" → ") || t("settings.diag_no_steps"),
                  ].join(" · ")}
                />
              ) : null}
              {props.cloudMcpHealth.firstFailure ? (
                <DiagnosticRow
                  label={t("settings.cloud_mcp_first_failure")}
                  value={`${props.cloudMcpHealth.firstFailure.code} (${t("settings.diag_stage")} ${props.cloudMcpHealth.firstFailure.stage}; ${props.cloudMcpHealth.firstFailure.retryable ? t("settings.diag_retryable") : t("settings.diag_not_retryable")}): ${props.cloudMcpHealth.firstFailure.message}`}
                />
              ) : null}
              <DiagnosticRow label={t("settings.cloud_mcp_plugin_canaries")} value={`${t("connect.diagnostics_agent_state_present")} ${joinList(props.cloudMcpHealth.pluginCanaries.present)}; ${t("connect.diagnostics_agent_state_missing")} ${joinList(props.cloudMcpHealth.pluginCanaries.missing)}`} />
              <DiagnosticRow label={t("settings.cloud_mcp_safe_capabilities")} value={`${t("settings.diag_schema")} v${props.cloudMcpHealth.schemaVersion}; ${t("settings.diag_connect_catalog")} ${props.cloudMcpHealth.connectCatalogEnabled ? t("plugins.enabled") : t("settings.disabled")}`} />
              {compatibility ? (
                <>
                  <DiagnosticRow label={t("settings.cloud_mcp_openwork_versions")} value={`${t("connect.confirm_server_label")} ${formatMaybe(compatibility.openwork.serverVersion)}; ${t("settings.diag_app")} ${formatMetadataRecord(compatibility.openwork.app)}`} />
                  <DiagnosticRow label={t("settings.cloud_mcp_opencode_compatibility")} value={`${t("connect.diagnostics_evidence_expected")} ${formatMaybe(compatibility.opencode.expectedVersion)}; ${t("settings.diag_actual")} ${formatMaybe(compatibility.opencode.actualVersion)}; ${t("settings.diag_probe")} ${compatibility.opencode.probe}`} />
                  <DiagnosticRow label={t("settings.cloud_mcp_feature_probes")} value={formatSupportedFeatures(compatibility.supportedFeatures)} />
                  <DiagnosticRow label={t("settings.cloud_mcp_experimental_tool_ids")} value={formatMcpToolExposure(compatibility.experimentalToolIds)} />
                  <DiagnosticRow label={t("settings.cloud_mcp_experimental_provider_tools")} value={formatMcpToolExposure(compatibility.experimentalProviderTools)} />
                  <DiagnosticRow label={t("settings.cloud_mcp_plugin_hashes")} value={formatPluginHashes(compatibility.pluginFileHashes)} />
                </>
              ) : null}
              <DiagnosticRow label={t("settings.cloud_mcp_live_verification")} value={props.cloudMcpHealth.checkedAt} />
            </div>
            <details className="rounded-lg bg-gray-3 p-2">
              <summary className="cursor-pointer text-[11px] font-medium text-gray-11">{t("settings.cloud_mcp_show_health_json")}</summary>
              <pre className="mt-2 max-h-72 overflow-auto font-mono text-[11px] text-gray-11">
                {JSON.stringify(safeHealth, null, 2)}
              </pre>
            </details>
          </div>
        ) : (
          <SettingsNotice>{t("settings.cloud_mcp_no_health")}</SettingsNotice>
        )}
      </LayoutSectionItem>
    </LayoutSection>
  );
}

interface AdvancedRuntimeConfigSourcesSectionProps {
  busy: boolean;
  canInspect: boolean;
  configStatus: OpenworkRuntimeConfigStatus | null;
  configStatusBusy: boolean;
  configStatusError: string | null;
  onRefresh: () => Promise<void>;
}

function formatKeys(keys: string[]) {
  return keys.length ? keys.join(", ") : t("connect.diagnostics_none");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizedConfig(config: Record<string, unknown>): Record<string, unknown> {
  return sanitizeDiagnosticRecord(config);
}

function countRecord(value: unknown) {
  return isRecord(value) ? Object.keys(value).length : 0;
}

function countArray(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function providerModelCount(config: Record<string, unknown>) {
  const providers = isRecord(config.provider) ? config.provider : {};
  return Object.values(providers).reduce<number>((total, provider) => {
    if (!isRecord(provider)) return total;
    return total + countRecord(provider.models);
  }, 0);
}

function RuntimeConfigSummary(props: { config: Record<string, unknown> }) {
  const config = props.config;
  const providers = countRecord(config.provider);
  const models = providerModelCount(config);
  const agents = countRecord(config.agent);
  const plugins = countArray(config.plugin);
  const mcps = countRecord(config.mcp);
  const permissions = countRecord(config.permission);
  const disabledProviders = countArray(config.disabled_providers);
  const defaultAgent = typeof config.default_agent === "string" ? config.default_agent : t("config.not_set");

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg border border-gray-6 bg-gray-2/60 p-2">
        <div className="text-[10px] uppercase tracking-wide text-gray-8">{t("session.default_agent")}</div>
        <div className="mt-1 truncate font-mono text-[11px] text-gray-12" title={defaultAgent}>{defaultAgent}</div>
      </div>
      <div className="rounded-lg border border-gray-6 bg-gray-2/60 p-2">
        <div className="text-[10px] uppercase tracking-wide text-gray-8">{t("settings.config_summary_providers_models")}</div>
        <div className="mt-1 font-mono text-[11px] text-gray-12">{t("settings.config_summary_providers_models_value", { providers, models })}</div>
      </div>
      <div className="rounded-lg border border-gray-6 bg-gray-2/60 p-2">
        <div className="text-[10px] uppercase tracking-wide text-gray-8">{t("settings.config_summary_agents_plugins")}</div>
        <div className="mt-1 font-mono text-[11px] text-gray-12">{t("settings.config_summary_agents_plugins_value", { agents, plugins })}</div>
      </div>
      <div className="rounded-lg border border-gray-6 bg-gray-2/60 p-2">
        <div className="text-[10px] uppercase tracking-wide text-gray-8">{t("settings.config_summary_mcp_permissions")}</div>
        <div className="mt-1 font-mono text-[11px] text-gray-12">{t("settings.config_summary_mcp_permissions_value", { mcps, permissions })}</div>
      </div>
      {disabledProviders ? (
        <div className="rounded-lg border border-gray-6 bg-gray-2/60 p-2 sm:col-span-2 lg:col-span-4">
          <div className="text-[10px] uppercase tracking-wide text-gray-8">{t("settings.config_summary_disabled_providers")}</div>
          <div className="mt-1 font-mono text-[11px] text-gray-12">{disabledProviders}</div>
        </div>
      ) : null}
    </div>
  );
}

function RuntimeConfigSourceBlock(props: {
  title: string;
  description: string;
  path?: string;
  exists?: boolean;
  keys: string[];
  config: Record<string, unknown>;
}) {
  const safeConfig = sanitizedConfig(props.config);
  return (
    <div className="space-y-2 rounded-xl border border-gray-6 bg-gray-1/70 p-3">
      <div>
        <div className="font-medium text-gray-12">{props.title}</div>
        <div className="text-[11px] text-gray-9">{props.description}</div>
        {props.path ? <div className="mt-1 break-all font-mono text-[11px] text-gray-8">{props.path}</div> : null}
        {props.exists !== undefined ? <div className="text-[11px] text-gray-9">{props.exists ? t("status.cap_past_find") : t("settings.diag_not_found")}</div> : null}
        <div className="text-[11px] text-gray-9">{t("settings.diag_keys", { keys: formatKeys(props.keys) })}</div>
      </div>
      <RuntimeConfigSummary config={safeConfig} />
      <details className="rounded-lg bg-gray-3 p-2">
        <summary className="cursor-pointer text-[11px] font-medium text-gray-11">{t("settings.diag_show_raw_json")}</summary>
        <pre className="mt-2 max-h-56 overflow-auto font-mono text-[11px] text-gray-11">
          {JSON.stringify(safeConfig, null, 2)}
        </pre>
      </details>
    </div>
  );
}

export function AdvancedRuntimeConfigSourcesSection(props: AdvancedRuntimeConfigSourcesSectionProps) {
  const effectiveRuntimeConfig = props.configStatus
    ? sanitizedConfig(props.configStatus.effectiveRuntime ?? props.configStatus.runtime)
    : null;
  const runtimeConfig = props.configStatus ? sanitizedConfig(props.configStatus.runtime) : null;
  return (
    <LayoutSection id="advanced-config-sources">
      <LayoutSectionHeader>
        <LayoutSectionTitle>{t("settings.config_sources_title")}</LayoutSectionTitle>
        <LayoutSectionDescription>
          {t("settings.config_sources_desc")}
        </LayoutSectionDescription>
      </LayoutSectionHeader>

      <LayoutSectionItem>
        <LayoutSectionItemHeader>
          <LayoutSectionItemTitle>{t("settings.config_sources_snapshot_title")}</LayoutSectionItemTitle>
          <LayoutSectionItemDescription>
            {t("settings.config_sources_snapshot_desc")}
          </LayoutSectionItemDescription>
          <LayoutSectionItemHeaderActions>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void props.onRefresh()}
              disabled={props.busy || props.configStatusBusy || !props.canInspect}
            >
              <RefreshCcw size={14} className={props.configStatusBusy ? "animate-spin" : ""} />
              {t("common.refresh")}
            </Button>
          </LayoutSectionItemHeaderActions>
        </LayoutSectionItemHeader>
        {props.configStatusError ? <SettingsNotice>{props.configStatusError}</SettingsNotice> : null}
        {props.configStatus ? (
          <div className="space-y-3 rounded-xl border border-gray-6 bg-gray-1/60 p-3 text-xs text-gray-10">
            <div className="space-y-2 rounded-xl border border-blue-6/50 bg-blue-2/40 p-3">
              <div className="font-medium text-gray-12">{t("settings.config_sources_desired_title")}</div>
              <div className="text-[11px] text-gray-9">
                {t("settings.config_sources_desired_desc")}
              </div>
              <RuntimeConfigSummary config={effectiveRuntimeConfig ?? {}} />
              <details className="rounded-lg bg-gray-3 p-2">
                <summary className="cursor-pointer text-[11px] font-medium text-gray-11">{t("settings.config_sources_show_desired_json")}</summary>
                <pre className="mt-2 max-h-72 overflow-auto font-mono text-[11px] text-gray-11">
                  {JSON.stringify(effectiveRuntimeConfig, null, 2)}
                </pre>
              </details>
            </div>
            {props.configStatus.sources ? (
              <div className="space-y-3">
                <div>
                  <div className="font-medium text-gray-12">{t("settings.config_sources_breakdown_title")}</div>
                  <div className="text-[11px] text-gray-9">
                    {t("settings.config_sources_breakdown_desc")}
                  </div>
                </div>
                <RuntimeConfigSourceBlock
                  title={t("settings.config_sources_project_title")}
                  description={t("settings.config_sources_project_desc")}
                  path={props.configStatus.sources.projectOpencode.path}
                  exists={props.configStatus.sources.projectOpencode.exists}
                  keys={props.configStatus.sources.projectOpencode.keys}
                  config={props.configStatus.sources.projectOpencode.config}
                />
                <RuntimeConfigSourceBlock
                  title={t("settings.config_sources_global_title")}
                  description={t("settings.config_sources_global_desc")}
                  path={props.configStatus.sources.globalOpencode.path}
                  exists={props.configStatus.sources.globalOpencode.exists}
                  keys={props.configStatus.sources.globalOpencode.keys}
                  config={props.configStatus.sources.globalOpencode.config}
                />
                <RuntimeConfigSourceBlock
                  title={t("settings.config_sources_runtime_db_title")}
                  description={t("settings.config_sources_runtime_db_desc")}
                  keys={props.configStatus.sources.runtimeDatabase.keys}
                  config={props.configStatus.sources.runtimeDatabase.config}
                />
                <RuntimeConfigSourceBlock
                  title={t("settings.config_sources_injected_title")}
                  description={t("settings.config_sources_injected_desc")}
                  keys={props.configStatus.sources.injected.keys}
                  config={props.configStatus.sources.injected.config}
                />
              </div>
            ) : null}
            <div>
              <div className="font-medium text-gray-12">{t("settings.config_sources_runtime_database")}</div>
              <div>{t("settings.config_sources_stored_keys", { keys: formatKeys(props.configStatus.runtimeKeys) })}</div>
            </div>
            <div>
              <div className="font-medium text-gray-12">{t("settings.config_sources_user_file_title")}</div>
              <div className="break-all">{props.configStatus.userOpencode.path}</div>
              <div>{props.configStatus.userOpencode.exists ? t("status.cap_past_find") : t("settings.diag_not_found")}</div>
              <div>{t("settings.config_sources_user_keys", { keys: formatKeys(props.configStatus.userOpencode.keys) })}</div>
            </div>
            <div>
              <div className="font-medium text-gray-12">{t("settings.config_sources_runtime_db_json")}</div>
              <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-gray-3 p-2 font-mono text-[11px] text-gray-11">
                {JSON.stringify(runtimeConfig, null, 2)}
              </pre>
            </div>
          </div>
        ) : null}
      </LayoutSectionItem>
    </LayoutSection>
  );
}

export function AdvancedWorkspaceRunModeSection() {
  const { workspaceRunModeEnabled, toggleWorkspaceRunMode } = useFeatureFlagsPreferences();
  const restricted = useDesktopRestriction("allowControlSettings");
  return (
    <LayoutSection id="advanced-workspace-run-mode">
      <LayoutSectionHeader>
        <LayoutSectionTitle>{t("settings.run_mode_title")}</LayoutSectionTitle>
        <LayoutSectionDescription>{t("settings.run_mode_desc")}</LayoutSectionDescription>
      </LayoutSectionHeader>
      <LayoutSectionItem>
        <LayoutSectionItemHeader>
          <LayoutSectionItemTitle>{t("settings.run_mode_show")}</LayoutSectionItemTitle>
          <LayoutSectionItemDescription>
            {t("settings.run_mode_show_desc")}
          </LayoutSectionItemDescription>
          <LayoutSectionItemHeaderActions>
            <Switch
              data-testid="workspace-run-mode-flag"
              aria-label={t("settings.run_mode_show")}
              checked={workspaceRunModeEnabled}
              disabled={restricted || !isDesktopRuntime()}
              onCheckedChange={toggleWorkspaceRunMode}
            />
          </LayoutSectionItemHeaderActions>
        </LayoutSectionItemHeader>
        <LayoutSectionItemFootnote>
          {t("settings.run_mode_footnote")}
        </LayoutSectionItemFootnote>
      </LayoutSectionItem>
    </LayoutSection>
  );
}

export function AdvancedEngineV2PreviewSection(props: { client: OpenworkServerClient | null }) {
  const engine = useOpencodeEngineControls(props.client);
  const runtimeError = engine.status?.enabled ? engine.status.lastError : undefined;
  const engineNote = engine.blockedReason ?? (engine.migrating ? t("settings.engine_wait_migration") : undefined);
  return (
    <LayoutSection id="advanced-experimental-engine">
      <LayoutSectionHeader><LayoutSectionTitle>{t("settings.opencode_engine_label")}</LayoutSectionTitle></LayoutSectionHeader>
      <LayoutSectionItem>
        <LayoutSectionItemHeader>
          <LayoutSectionItemTitle>{t("settings.engine_chat_title")}</LayoutSectionItemTitle>
          <LayoutSectionItemHeaderActions>
            <ToggleGroup aria-label={t("settings.engine_chat_title")} value={[engine.selected]} variant="outline" disabled={engine.disabled}
              onValueChange={(value) => { if (value[0] === "v1" || value[0] === "v2") engine.select(value[0]); }}>
              <ToggleGroupItem value="v1" data-engine="v1">OpenCode v1</ToggleGroupItem>
              <ToggleGroupItem value="v2" data-engine="v2">{t("settings.engine_v2_preview_label")}</ToggleGroupItem>
            </ToggleGroup>
          </LayoutSectionItemHeaderActions>
        </LayoutSectionItemHeader>
        {engineNote ? <p className="text-xs text-muted-foreground">{engineNote}</p> : null}
        {engine.status?.enabled && !engine.status.running && !engine.status.lastError ? <p role="status" className="text-xs text-muted-foreground">{t("settings.engine_v2_starting")}</p> : null}
        {engine.error || runtimeError ? <p role="alert" className="text-xs text-destructive">{engine.error ?? runtimeError}</p> : null}
      </LayoutSectionItem>
      <LayoutSectionItem>
        <LayoutSectionItemHeader>
          <LayoutSectionItemTitle>{t("settings.engine_v1_history_title")}</LayoutSectionItemTitle>
          <LayoutSectionItemHeaderActions>
            {engine.migrating
              ? <Button variant="outline" size="sm" onClick={showEngineMigrationProgress}>{t("engine_migration.show_progress")}</Button>
              : <Button variant="outline" size="sm" disabled={engine.disabled || !engine.status?.migration} onClick={engine.openMigration}>{t("settings.engine_migrate_chats_button")}</Button>}
          </LayoutSectionItemHeaderActions>
        </LayoutSectionItemHeader>
        {engine.message ? <p role="status" className="text-xs text-muted-foreground">{engine.message}</p> : null}
      </LayoutSectionItem>
      <details className="text-xs text-muted-foreground"><summary>{t("settings.engine_details_title")}</summary>
        <p className="py-2">{t("settings.engine_details_note")}</p>
        {engine.status?.running ? <p>{t("settings.engine_status_summary", { version: engine.status.version ?? t("common.unknown"), providers: engine.status.mirroredProviderIds.length, models: engine.status.catalogModelIds.length })}</p> : null}
      </details>
    </LayoutSection>
  );
}

interface AdvancedDeveloperSectionProps {
  busy: boolean;
  developerMode: boolean;
  opencodeDevModeEnabled: boolean;
  deepLinkOpen: boolean;
  deepLinkInput: string;
  deepLinkBusy: boolean;
  deepLinkStatus: string | null;
  onToggleDeveloperMode: () => void;
  onToggleDeepLink: () => void;
  onDeepLinkInput: (input: string) => void;
  onSubmitDeepLink: () => Promise<void>;
}

export function AdvancedDeveloperSection(props: AdvancedDeveloperSectionProps) {
  return (
    <LayoutSection id="advanced-developer">
      <LayoutSectionHeader>
        <LayoutSectionTitle>{t("settings.developer")}</LayoutSectionTitle>
      </LayoutSectionHeader>

      <LayoutSectionItem>
        <LayoutSectionItemHeader>
          <LayoutSectionItemTitle>{t("settings.developer_mode_title")}</LayoutSectionItemTitle>
          <LayoutSectionItemDescription>{t("settings.developer_mode_desc")}</LayoutSectionItemDescription>
          <LayoutSectionItemHeaderActions>
            <Switch
              aria-label={t("settings.developer_mode_title")}
              checked={props.developerMode}
              onCheckedChange={props.onToggleDeveloperMode}
            />
          </LayoutSectionItemHeaderActions>
        </LayoutSectionItemHeader>
      </LayoutSectionItem>

      {isDesktopRuntime() && props.opencodeDevModeEnabled && props.developerMode ? (
        <LayoutSectionItem>
          <LayoutSectionItemHeader>
            <LayoutSectionItemTitle>{t("settings.open_deeplink_title")}</LayoutSectionItemTitle>
            <LayoutSectionItemDescription>{t("settings.open_deeplink_desc")}</LayoutSectionItemDescription>
            <LayoutSectionItemHeaderActions>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={props.onToggleDeepLink}
                disabled={props.busy || props.deepLinkBusy}
              >
                {props.deepLinkOpen ? t("common.hide") : t("settings.open_deeplink_button")}
              </Button>
            </LayoutSectionItemHeaderActions>
          </LayoutSectionItemHeader>

          {props.deepLinkOpen ? (
            <div className="space-y-3">
              <Field>
                <FieldLabel htmlFor="advanced-debug-deep-link">{t("settings.open_deeplink_title")}</FieldLabel>
                <Textarea
                  id="advanced-debug-deep-link"
                  value={props.deepLinkInput}
                  onChange={(event) => props.onDeepLinkInput(event.currentTarget.value)}
                  rows={3}
                  placeholder="openwork://..."
                  className="font-mono text-xs"
                />
              </Field>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void props.onSubmitDeepLink()}
                  disabled={props.busy || props.deepLinkBusy || !props.deepLinkInput.trim()}
                >
                  {props.deepLinkBusy ? t("settings.opening") : t("settings.open_deeplink_action")}
                </Button>
                <div className="text-xs text-gray-8">{t("settings.deeplink_hint")}</div>
              </div>
            </div>
          ) : null}

          {props.deepLinkStatus ? <SettingsNotice>{props.deepLinkStatus}</SettingsNotice> : null}
        </LayoutSectionItem>
      ) : null}
    </LayoutSection>
  );
}
