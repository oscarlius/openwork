import { t } from "@/i18n";

/**
 * Titles are read lazily through a getter: this table is module-level, so calling
 * `t()` while building it would freeze the language at import time. Consumers
 * (Settings › Advanced navigation and the command palette) read `title` while
 * rendering, which is when the label must resolve.
 */
export const ADVANCED_SETTINGS_SECTIONS = [
  { id: "organization-server", get title() { return t("settings.organization_server_title"); }, keywords: ["den", "control plane", "server url", "reset server"] },
  { id: "runtime", get title() { return t("settings.runtime_title"); }, keywords: ["opencode engine", "openwork server", "connection status"] },
  { id: "agent-access", get title() { return t("settings.cloud_mcp_title"); }, keywords: ["cloud mcp", "health", "tools", "connections"] },
  { id: "config-sources", get title() { return t("settings.config_sources_title"); }, keywords: ["runtime db", "injected config", "project config", "global config"] },
  { id: "experimental-engine", get title() { return t("settings.experimental_engine_title"); }, keywords: ["engine v2", "chat engine", "preview"] },
  { id: "workspace-run-mode", get title() { return t("settings.run_mode_title"); }, keywords: ["approvals", "permissions", "keep going", "feature flag"] },
  { id: "developer", get title() { return t("settings.developer"); }, keywords: ["developer mode", "debug", "deep link"] },
];
