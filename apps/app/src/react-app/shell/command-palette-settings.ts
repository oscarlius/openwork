import type { PlatformCapabilities } from "@/app/lib/platform-capabilities";
import { isSettingsTabAllowed, type DesktopAppRestrictionChecker } from "@/app/cloud/desktop-app-restrictions";
import type { SettingsTab } from "@/app/types";
import {
  CLOUD_SETTINGS_TABS,
  getGlobalSettingsTabs,
  getSettingsTabDescription,
  getSettingsTabLabel,
  getWorkspaceSettingsTabs,
} from "@/react-app/domains/settings/shell/settings-page";

import { t } from "@/i18n";
import { ADVANCED_SETTINGS_SECTIONS } from "@/react-app/domains/settings/advanced-sections";

import type { PaletteItem } from "./command-palette-search";

const SETTINGS_KEYWORDS: Partial<Record<SettingsTab, string[]>> = {
  ai: ["provider", "providers", "api key", "anthropic", "openai", "openrouter", "google", "gemini", "claude", "gpt", "connect model", "models"],
  preferences: ["default model", "reasoning", "thinking", "compaction", "effort"],
  permissions: ["authorized folders", "folder access", "file access", "allow", "permission denied", "sandbox", "approvals"],
  extensions: ["library", "skills", "plugins", "mcp", "connections", "tools", "apps"],
  environment: ["env", "environment variables", "secrets", "tokens", "api keys"],
  advanced: ["advanced settings", "runtime", "developer", "connection", "server", "port", "reset", "fix", "repair", "clean up", "troubleshoot", "recovery"],
  shortcuts: ["shortcut", "shortcuts", "keyboard", "keys", "hotkey", "keybinding", "switch model", "fast"],
  appearance: ["theme", "dark mode", "light mode", "color", "font", "look"],
  updates: ["version", "upgrade", "check for updates", "release"],
  debug: ["logs", "diagnostics", "developer mode"],
  usage: ["usage", "limit", "spend", "budget", "quota", "increase"],
  "cloud-account": ["sign in", "log in", "login", "account", "organization", "org", "den", "cloud", "openwork cloud"],
  general: ["settings", "preferences", "options", "configure"],
};

// Localized on call (never at module load) so the palette re-renders when the
// language changes. See EXTRACTION-CONTRACT §6.
function getLibrarySections(): Array<{ slug: string; title: string; detail: string; keywords: string[] }> {
  return [
    { slug: "skills", title: t("settings.tab_skills"), detail: t("palette.library_skills_desc"), keywords: ["skill", "instructions", "workflows"] },
    { slug: "mcps", title: t("palette.library_mcps_title"), detail: t("palette.library_mcps_desc"), keywords: ["mcp", "servers", "tools"] },
    { slug: "connections", title: t("activity.filter_connections"), detail: t("palette.library_connections_desc"), keywords: ["apps", "services", "sign in"] },
    { slug: "plugins", title: t("extensions.filter_plugins"), detail: t("palette.library_plugins_desc"), keywords: ["extensions", "tools", "hooks"] },
    { slug: "agents", title: t("extensions.filter_agents"), detail: t("palette.library_agents_desc"), keywords: ["agent", "assistants", "modes"] },
    { slug: "commands", title: t("extensions.filter_commands"), detail: t("palette.library_commands_desc"), keywords: ["command", "slash", "prompts"] },
  ];
}

export function buildCommandPaletteSettingsItems(input: {
  developerMode: boolean;
  capabilities: Pick<PlatformCapabilities, "autoUpdate">;
  /** Desktop policy checker; when `allowControlSettings` is blocked only the Cloud tabs remain. */
  checkRestriction?: DesktopAppRestrictionChecker;
  onOpenSettings: (route: string) => void;
  onOpenExtensions: (section?: string) => void;
}): PaletteItem[] {
  const checkRestriction = input.checkRestriction ?? (() => false);
  const tabs = ([
    "general",
    ...getWorkspaceSettingsTabs(),
    ...getGlobalSettingsTabs(input.developerMode, input.capabilities),
    ...CLOUD_SETTINGS_TABS,
  ] satisfies SettingsTab[]).filter((tab) => isSettingsTabAllowed({ tab, checkRestriction }));

  const tabItems = tabs.map((tab): PaletteItem => ({
    id: `settings:${tab}`,
    title: tab === "advanced" ? t("mcp.advanced_settings") : getSettingsTabLabel(tab),
    detail: getSettingsTabDescription(tab),
    keywords: SETTINGS_KEYWORDS[tab],
    breadcrumb: t("status.settings"),
    group: "settings",
    action: () => {
      if (tab === "extensions") {
        input.onOpenExtensions();
        return;
      }
      input.onOpenSettings(`/settings/${tab}`);
    },
  }));

  const libraryItems = getLibrarySections().map((section): PaletteItem => ({
    id: `settings:extensions/${section.slug}`,
    title: section.title,
    detail: section.detail,
    keywords: section.keywords,
    breadcrumb: "Settings › Library",
    group: "settings",
    action: () => input.onOpenExtensions(section.slug),
  }));

  const advancedItems: PaletteItem[] = tabs.includes("advanced")
    ? ADVANCED_SETTINGS_SECTIONS.map((section) => ({
        id: `settings:advanced/${section.id}`,
        title: section.title,
        keywords: section.keywords,
        breadcrumb: "Settings › Advanced",
        group: "settings",
        action: () => input.onOpenSettings(`/settings/advanced/${section.id}`),
      }))
    : [];

  return input.developerMode
    ? [...advancedItems, ...tabItems, ...libraryItems]
    : [...tabItems, ...advancedItems, ...libraryItems];
}
