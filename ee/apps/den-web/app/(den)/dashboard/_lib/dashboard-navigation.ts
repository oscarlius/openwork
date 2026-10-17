import {
  BarChart3,
  Box,
  CalendarClock,
  Globe,
  Laptop,
  LibraryBig,
  LockKeyhole,
  MessageCircle,
  ScrollText,
  Server,
  Plug,
  SlidersHorizontal,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  type DenOrgAccessFlags,
  type DenOrgCapabilities,
  getAiGatewayRoute,
  getAnalyticsRoute,
  getApiKeysRoute,
  getAuditLogsRoute,
  getAutomationsRoute,
  getBillingRoute,
  getDesktopPoliciesRoute,
  getDiagnosticsRoute,
  getDeploymentsRoute,
  getLibraryRoute,
  getMarketplacesRoute,
  getMcpConnectionsRoute,
  getMembersRoute,
  getOrgSettingsRoute,
  getPermissionsRoute,
  getPluginsRoute,
  getScimRoute,
  getSsoRoute,
  getToolTesterRoute,
  getWebRoute,
  getWorkbotSettingsRoute,
} from "../../_lib/den-org";
import type { DenMessageKey } from "../../../_lib/i18n/messages";
import type { DenOrgMode } from "../../_lib/runtime-config";
import { canOpenAdminRoute } from "./admin-route-access";

export type DashboardNavChild = {
  href: string;
  label: string;
  /**
   * Message key holding the visible text. `label` stays English on purpose: it
   * is the command-palette search keyword key and the `data-*` identity, so a
   * translated `label` would break search. Screens render `t(labelKey)`.
   */
  labelKey: DenMessageKey;
  badgeKey?: DenMessageKey;
};

export type DashboardNavItem = {
  href: string;
  label: string;
  labelKey: DenMessageKey;
  icon: LucideIcon;
  badgeKey?: DenMessageKey;
  /** Quiet dot beside the label when something here is waiting on the viewer. */
  attentionCount?: number;
  testId?: string;
  /** Extra pathname prefixes that select this entry. */
  matchHrefs?: string[];
  /** Grouped entries link to their own href and expand on parent or child pages. */
  children?: DashboardNavChild[];
};

export type DashboardNavSection = {
  label: string;
  labelKey: DenMessageKey;
  items: DashboardNavItem[];
};

export type DashboardSearchItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  section: string;
  keywords: string[];
};

export type BuildDashboardNavSectionsInput = {
  orgSlug: string | null;
  access: DenOrgAccessFlags;
  capabilities: DenOrgCapabilities;
  orgMode: DenOrgMode;
  runtimeConfigLoaded: boolean;
  /** How many Library items wait on the viewer's sign-in. */
  libraryNeedsSignIn?: number;
  /** The organization has the `permissions` feature (orgFeatureEnabled). */
  permissionsEnabled?: boolean;
  /** teamRoles: roles live in Members › Roles, so Settings › Permissions steps aside. */
  teamRoles?: boolean;
  /** The managedDeployments feature is on for this organization. */
  managedDeployments?: boolean;
  /** Workbot is on: admins choose the organization's default model. */
  workbotSettings?: boolean;
  desktopPolicyScreenRemoved?: boolean;
};

/** An href the viewer is allowed to open, per their permission flags. */
type NavFilter = (href: string) => boolean;

export function buildDashboardNavSections({
  orgSlug,
  access,
  capabilities,
  runtimeConfigLoaded,
  libraryNeedsSignIn = 0,
  permissionsEnabled = false,
  teamRoles = false,
  managedDeployments = false,
  workbotSettings = false,
  desktopPolicyScreenRemoved = false,
}: BuildDashboardNavSectionsInput): DashboardNavSection[] {
  const workflowsEnabled = capabilities.workflows;
  const showWeb = runtimeConfigLoaded && capabilities.openworkWeb;

  // Admin-area entries appear only where the member holds the page's permission.
  const canOpen = (href: string) => canOpenAdminRoute(href, access);

  /*
   * Every conditional group is its own annotated constant, and no array literal
   * below spreads a ternary. That is deliberate: an array literal containing a
   * spread of a conditional expression loses its contextual type, which widens
   * every `labelKey` in it from the `DenMessageKey` union to plain `string` and
   * stops it being assignable to `DashboardNavItem`. A `: DashboardNavItem[]`
   * annotation on the outer variable does not restore it; `satisfies` on a
   * branch does not either, because the sibling entries still lose the context.
   */
  const workbotItem: DashboardNavItem[] = capabilities.workbot
    ? [{ href: "/workbot", label: "Workbot", labelKey: "denShell.nav.workbot", icon: MessageCircle, testId: "dashboard-nav-workbot" }]
    : [];
  const automationsItem: DashboardNavItem[] = workflowsEnabled && orgSlug
    ? [{ href: getAutomationsRoute(orgSlug), label: "My Automations", labelKey: "denShell.nav.myAutomations", icon: CalendarClock }]
    : [];
  const webItem: DashboardNavItem[] = showWeb
    ? [{ href: orgSlug ? getWebRoute(orgSlug) : "#", label: "OpenWork Web", labelKey: "denShell.nav.openworkWeb", icon: Globe }]
    : [];
  const workItems: DashboardNavItem[] = [
    ...workbotItem,
    {
      href: orgSlug ? getLibraryRoute(orgSlug) : "#",
      label: "My Library",
      labelKey: "denShell.nav.myLibrary",
      icon: LibraryBig,
      ...(libraryNeedsSignIn > 0 ? { attentionCount: libraryNeedsSignIn } : {}),
    },
    ...automationsItem,
    ...webItem,
  ];

  const manageItems: DashboardNavItem[] = orgSlug
    ? manageNavItems(orgSlug, capabilities, {
        canOpen,
        desktopPolicyScreenRemoved,
        workbotSettings,
        managedDeployments,
      })
    : [];
  const observabilityItems: DashboardNavItem[] = orgSlug
    ? observabilityNavItems(orgSlug, access, capabilities)
    : [];
  const settingsChildren: DashboardNavChild[] = orgSlug
    ? settingsNavChildren(orgSlug, access, capabilities, { canOpen, permissionsEnabled, teamRoles })
    : [];
  const settingsGroup: DashboardNavItem | null = settingsChildren.length > 0
    ? {
        href: settingsChildren[0].href,
        label: "Settings",
        labelKey: "denShell.nav.settings",
        icon: SlidersHorizontal,
        children: settingsChildren,
      }
    : null;
  const membersItem: DashboardNavItem[] = orgSlug && canOpen(getMembersRoute(orgSlug))
    ? [{ href: getMembersRoute(orgSlug), label: "Members", labelKey: "denShell.nav.members", icon: Users }]
    : [];
  const settingsItem: DashboardNavItem[] = settingsGroup ? [settingsGroup] : [];
  const teamItems: DashboardNavItem[] = [...membersItem, ...settingsItem];

  const workSection: DashboardNavSection = { label: "Work", labelKey: "denShell.nav.sectionWork", items: workItems };
  const manageSection: DashboardNavSection[] = manageItems.length > 0
    ? [{ label: "Manage", labelKey: "denShell.nav.sectionManage", items: manageItems }]
    : [];
  const observabilitySection: DashboardNavSection[] = observabilityItems.length > 0
    ? [{ label: "Observability", labelKey: "denShell.nav.sectionObservability", items: observabilityItems }]
    : [];
  const teamSection: DashboardNavSection[] = teamItems.length > 0
    ? [{ label: "Team", labelKey: "denShell.nav.sectionTeam", items: teamItems }]
    : [];

  return [workSection, ...manageSection, ...observabilitySection, ...teamSection];
}

/** Manage-area entries, kept only where the viewer can open the page. */
function manageNavItems(
  orgSlug: string,
  capabilities: DenOrgCapabilities,
  options: {
    canOpen: NavFilter;
    desktopPolicyScreenRemoved: boolean;
    workbotSettings: boolean;
    managedDeployments: boolean;
  },
): DashboardNavItem[] {
  const { canOpen, desktopPolicyScreenRemoved, workbotSettings, managedDeployments } = options;
  const desktopPoliciesItem: DashboardNavItem[] = desktopPolicyScreenRemoved
    ? []
    : [{ href: getDesktopPoliciesRoute(orgSlug), label: "Desktop policies", labelKey: "denShell.nav.desktopPolicies", icon: Laptop }];
  const workbotSettingsItem: DashboardNavItem[] = workbotSettings
    ? [{ href: getWorkbotSettingsRoute(orgSlug), label: "Workbot", labelKey: "denShell.nav.workbot", icon: MessageCircle, testId: "dashboard-nav-workbot-settings" }]
    : [];
  const deploymentsItem: DashboardNavItem[] = managedDeployments
    ? [{ href: getDeploymentsRoute(orgSlug), label: "Deployments", labelKey: "denShell.nav.deployments", icon: Server }]
    : [];
  const items: DashboardNavItem[] = [
    { href: getPluginsRoute(orgSlug), label: "Plugins", labelKey: "denShell.nav.plugins", icon: Box },
    { href: getMcpConnectionsRoute(orgSlug), label: "Connectors", labelKey: "denShell.nav.connectors", icon: Plug, badgeKey: "denShell.nav.badgeMcps" },
    { href: getAiGatewayRoute(orgSlug), label: "AI Gateway", labelKey: "denShell.nav.aiGateway", icon: Sparkles },
    ...desktopPoliciesItem,
    ...workbotSettingsItem,
    ...deploymentsItem,
  ];
  return items.filter((item) => canOpen(item.href));
}

/** Analytics and Audit logs: one appears on permission, the other on capability. */
function observabilityNavItems(
  orgSlug: string,
  access: DenOrgAccessFlags,
  capabilities: DenOrgCapabilities,
): DashboardNavItem[] {
  const analyticsItem: DashboardNavItem[] = access.canViewUsageAnalytics
    ? [{ href: getAnalyticsRoute(orgSlug), label: "Analytics", labelKey: "denShell.nav.analytics", icon: BarChart3 }]
    : [];
  const auditLogsItem: DashboardNavItem[] = capabilities.auditLogs
    ? [{
        href: getAuditLogsRoute(orgSlug),
        label: "Audit logs",
        labelKey: "denShell.nav.auditLogs",
        icon: access.canViewAuditLogs ? ScrollText : LockKeyhole,
        ...(access.canViewAuditLogs ? {} : { badgeKey: "denShell.nav.badgeLocked" }),
      }]
    : [];
  return [...analyticsItem, ...auditLogsItem];
}

/** The Settings group's children, in the order the sidebar shows them. */
function settingsNavChildren(
  orgSlug: string,
  access: DenOrgAccessFlags,
  capabilities: DenOrgCapabilities,
  options: { canOpen: NavFilter; permissionsEnabled: boolean; teamRoles: boolean },
): DashboardNavChild[] {
  const { canOpen, permissionsEnabled, teamRoles } = options;
  const coreChildren: DashboardNavChild[] = [
    { href: getOrgSettingsRoute(orgSlug), label: "General", labelKey: "denShell.nav.general" },
    { href: getDiagnosticsRoute(orgSlug), label: "Diagnostics", labelKey: "denShell.nav.diagnostics" },
    { href: getBillingRoute(orgSlug), label: "Billing", labelKey: "denShell.nav.billing" },
    { href: getApiKeysRoute(orgSlug), label: "API Keys", labelKey: "denShell.nav.apiKeys" },
  ];
  const ssoChild: DashboardNavChild[] = access.canViewSso
    ? [{ href: getSsoRoute(orgSlug), label: "SSO", labelKey: "denShell.nav.sso" }]
    : [];
  const scimChild: DashboardNavChild[] = access.canViewScim
    ? [{ href: getScimRoute(orgSlug), label: "SCIM", labelKey: "denShell.nav.scim" }]
    : [];
  const advancedChild: DashboardNavChild[] = canOpen(getMarketplacesRoute(orgSlug))
    ? [{ href: getMarketplacesRoute(orgSlug), label: "Advanced", labelKey: "denShell.nav.advanced" }]
    : [];
  const toolTesterChild: DashboardNavChild[] = capabilities.mcpConnections && canOpen(getToolTesterRoute(orgSlug))
    ? [{ href: getToolTesterRoute(orgSlug), label: "Tool Tester", labelKey: "denShell.nav.toolTester" }]
    : [];

  return [
    ...coreChildren.filter((item) => canOpen(item.href)),
    ...permissionsNavChildren(orgSlug, access, permissionsEnabled, teamRoles ? { membersOpen: canOpen(getMembersRoute(orgSlug)) } : null),
    ...ssoChild,
    ...scimChild,
    ...advancedChild,
    ...toolTesterChild,
  ];
}

/**
 * Permissions appears for members who hold `permissions.view` while the feature
 * is on. While it is off, people who could manage it keep a locked entry that
 * says why (DESIGN.md P4); everyone else does not see it.
 *
 * With teamRoles, roles have one home, Members › Roles: the entry is dropped
 * for people who can open Members, and named Roles for anyone who can't.
 */
function permissionsNavChildren(orgSlug: string, access: DenOrgAccessFlags, enabled: boolean, teamRoles: { membersOpen: boolean } | null): DashboardNavChild[] {
  const href = getPermissionsRoute(orgSlug);
  if (enabled && teamRoles) return access.canViewPermissions && !teamRoles.membersOpen ? [{ href, label: "Roles", labelKey: "denShell.nav.roles" }] : [];
  if (enabled) return access.canViewPermissions ? [{ href, label: "Permissions", labelKey: "denShell.nav.permissions" }] : [];
  return access.canManagePermissions ? [{ href, label: "Permissions", labelKey: "denShell.nav.permissions", badgeKey: "denShell.nav.badgeEnterprise" }] : [];
}

// Alias order is ranking priority in the command palette.
const PAGE_KEYWORDS: Record<string, string[]> = {
  Advanced: ["marketplace", "collections", "branding", "brand appearance"],
  "AI Gateway": ["llm", "provider", "gateway", "inference", "usage"],
  Analytics: ["usage", "stats", "workflow runs", "history"],
  "Audit logs": ["audit", "history", "operations", "changes", "security"],
  "API Keys": ["token", "secret"],
  Billing: ["plan", "invoice", "payment"],
  "Bring Your Own Keys (Legacy)": ["llm", "provider", "byok", "api key"],
  Connectors: ["mcp", "integrations", "servers", "connect"],
  "Desktop policies": ["policy", "mdm", "lock", "desktop"],
  Deployments: ["aws", "self-hosted", "byoc", "install", "health", "status"],
  Dashboards: ["boards", "apps"],
  Diagnostics: ["health", "debug", "troubleshooting"],
  General: ["organization", "workspace"],
  // Agent permissions live on Members › Teams (Everyone and each team's Agents tab).
  Members: ["people", "users", "invite", "teams", "roles", "agent permissions", "commands", "websites", "allow list", "block list", "desktop", "prompt suggestions"],
  Models: ["llm", "provider", "byok", "api key"],
  Permissions: ["access", "roles", "teams", "admin", "rbac"],
  "My Automations": ["schedule", "recurring", "tasks"],
  "My Library": ["skills", "plugins", "connections"],
  "OpenWork Models": ["llm", "provider", "managed", "inference"],
  "OpenWork Web": ["cloud", "sessions"],
  Plugins: ["skills", "commands", "plugin directory"],
  SCIM: ["provisioning", "directory", "users"],
  Settings: ["organization", "workspace"],
  SSO: ["single sign on", "saml", "oidc"],
  "Tool Tester": ["tools", "test", "mcp"],
  Workbot: ["model", "default model", "assistant", "slack", "automations"],
};

function keywordsFor(...labels: string[]): string[] {
  return [...new Set(labels.flatMap((label) => PAGE_KEYWORDS[label] ?? []))];
}

export function flattenNavigationForSearch(sections: DashboardNavSection[]): DashboardSearchItem[] {
  return sections.flatMap((section) => section.items.flatMap((item) => {
    if (item.children) {
      return item.children.map((child) => ({
        id: `page:${section.label}:${item.label}:${child.label}`,
        label: `${item.label} › ${child.label}`,
        href: child.href,
        icon: item.icon,
        section: section.label,
        keywords: keywordsFor(item.label, child.label),
      }));
    }

    return [{
      id: `page:${section.label}:${item.label}`,
      label: item.label,
      href: item.href,
      icon: item.icon,
      section: section.label,
      keywords: keywordsFor(item.label),
    }];
  }));
}
