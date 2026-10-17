/**
 * English interface messages for OpenWork Den.
 *
 * This file is the schema: every key here must exist in `zh.ts`, and the
 * `{placeholder}` sets must match key for key (`pnpm -C ee/apps/den-web
 * i18n:check` asserts both). `en.ts` is also the source of truth for the exact
 * wording that was on screen before translation, so a converted file must copy
 * its original string in verbatim — including capitalisation, ellipses,
 * typographic dashes and leading spaces inside interpolated sentences.
 *
 * Key naming: `region.interfaceElement.semantics`, three lowercase dot
 * segments (see ../GLOSSARY.md for the prefix allocation table).
 */

const en = {
  // ---------------------------------------------------------------- root ----
  "denRoot.document.title": "OpenWork Cloud",
  "denRoot.document.description":
    "Share your OpenWork setup with your team, manage billing, and use OpenWork Cloud from app.openworklabs.com.",
  "denRoot.socialGraph.description":
    "Share your OpenWork setup with your team and keep selected workflows available in OpenWork Cloud.",
  "denRoot.socialPreview.description":
    "Share your OpenWork setup with your team and manage OpenWork Cloud from app.openworklabs.com.",

  // ------------------------------------------------------------ dashboard ----
  "denDashboard.document.title": "OpenWork Cloud",

  // ---------------------------------------------------------------- shell ----
  "denShell.brandIcon.loadingLabel": "Loading organization icon",
  "denShell.brandIcon.imageAlt": "{organizationName} icon",
  "denShell.role.admin": "Admin",
  "denShell.role.member": "Member",
  "denShell.workspace.preparing": "Preparing workspace",
  "denShell.workspace.loading": "Loading...",
  "denShell.workspace.switcherLabel": "Workspace switcher",
  "denShell.workspace.switchAction": "Switch workspace",
  "denShell.workspace.searchPlaceholder": "Search workspaces",
  "denShell.workspace.noMatch": "No organizations match your search.",
  "denShell.workspace.showMore": "Show more ({count})",
  "denShell.workspace.createOrJoin": "Create or join workspace",
  "denShell.workspace.refreshing": "Refreshing workspace…",
  "denShell.workspace.planCreator": "Creator plan",
  "denShell.workspace.planFree": "Free plan",
  "denShell.workspace.defaultOrganizationName": "OpenWork",
  "denShell.workspace.defaultUserName": "OpenWork user",
  "denShell.memberCount.one": "{count} member",
  "denShell.memberCount.other": "{count} members",
  "denShell.account.signOut": "Sign out",
  "denShell.menuButton.closeLabel": "Close menu",
  "denShell.menuButton.openLabel": "Open menu",
  "denShell.header.feedback": "Feedback",
  "denShell.header.docs": "Docs",
  "denShell.header.backToSetup": "Back to setup",
  "denShell.profilePrompt.descriptor": "Change how your name appears in the organization",

  // Language switcher (only rendered while denLocaleSelection is on).
  "denShell.language.label": "Language",
  "denShell.language.selectLabel": "Interface language",

  // Sidebar navigation. `label` stays English in code for search keywords and
  // the data-sidebar-section attribute; these keys drive the visible text.
  "denShell.nav.sectionWork": "Work",
  "denShell.nav.sectionManage": "Manage",
  "denShell.nav.sectionObservability": "Observability",
  "denShell.nav.sectionTeam": "Team",
  "denShell.nav.workbot": "Workbot",
  "denShell.nav.myLibrary": "My Library",
  "denShell.nav.myAutomations": "My Automations",
  "denShell.nav.openworkWeb": "OpenWork Web",
  "denShell.nav.plugins": "Plugins",
  "denShell.nav.connectors": "Connectors",
  "denShell.nav.aiGateway": "AI Gateway",
  "denShell.nav.desktopPolicies": "Desktop policies",
  "denShell.nav.deployments": "Deployments",
  "denShell.nav.analytics": "Analytics",
  "denShell.nav.auditLogs": "Audit logs",
  "denShell.nav.settings": "Settings",
  "denShell.nav.members": "Members",
  "denShell.nav.general": "General",
  "denShell.nav.diagnostics": "Diagnostics",
  "denShell.nav.billing": "Billing",
  "denShell.nav.apiKeys": "API Keys",
  "denShell.nav.sso": "SSO",
  "denShell.nav.scim": "SCIM",
  "denShell.nav.advanced": "Advanced",
  "denShell.nav.toolTester": "Tool Tester",
  "denShell.nav.permissions": "Permissions",
  "denShell.nav.roles": "Roles",
  "denShell.nav.badgeMcps": "MCPs",
  "denShell.nav.badgeLocked": "Locked",
  "denShell.nav.badgeEnterprise": "Enterprise",
  "denShell.nav.attention.one": "{count} needs your sign-in",
  "denShell.nav.attention.other": "{count} need your sign-in",

  // Header page title (same words as the nav, but a different surface).
  "denShell.pageTitle.home": "Home",
  "denShell.pageTitle.auditLogs": "Audit logs",
  "denShell.pageTitle.analytics": "Analytics",
  "denShell.pageTitle.members": "Members",
  "denShell.pageTitle.permissions": "Permissions",
  "denShell.pageTitle.apiKeys": "API Keys",
  "denShell.pageTitle.scim": "SCIM",
  "denShell.pageTitle.sso": "SSO",
  "denShell.pageTitle.myAutomations": "My Automations",
  "denShell.pageTitle.bringYourOwnKeys": "Bring your Own Keys",
  "denShell.pageTitle.aiGateway": "AI Gateway",
  "denShell.pageTitle.desktopPolicies": "Desktop policies",
  "denShell.pageTitle.workbot": "Workbot",
  "denShell.pageTitle.advanced": "Advanced",
  "denShell.pageTitle.deployments": "Deployments",
  "denShell.pageTitle.diagnostics": "Diagnostics",
  "denShell.pageTitle.openworkWeb": "OpenWork Web",
  "denShell.pageTitle.myLibrary": "My Library",
  "denShell.pageTitle.plugins": "Plugins",
  "denShell.pageTitle.connectors": "Connectors",
  "denShell.pageTitle.yourConnections": "Your Connections",
  "denShell.pageTitle.workflowRuns": "Workflow Runs",
  "denShell.pageTitle.toolTester": "Tool Tester",
  "denShell.pageTitle.billing": "Billing",
  "denShell.pageTitle.orgSettings": "Org Settings",
  "denShell.pageTitle.roles": "Roles",

  // --------------------------------------------------- desktop policies ----
  "denDesktopPolicies.action.newPolicy": "New policy",
  "denDesktopPolicies.action.viewTeamAccess": "View team access",
  "denDesktopPolicies.action.edit": "Edit",
  "denDesktopPolicies.action.view": "View",
  "denDesktopPolicies.action.delete": "Delete",
  "denDesktopPolicies.column.priority": "Priority",
  "denDesktopPolicies.badge.teamAccess": "Team access · {mode}",
  "denDesktopPolicies.badge.accessLocked": "Locked",
  "denDesktopPolicies.badge.accessCustom": "Custom",
  "denDesktopPolicies.badge.default": "Default",
  "denDesktopPolicies.badge.restricted": "Restricted",
  "denDesktopPolicies.list.count.one": "{count} policy",
  "denDesktopPolicies.list.count.other": "{count} policies",
  "denDesktopPolicies.list.createdOn": "Created {date}",
  "denDesktopPolicies.list.fallbackValue": "Fallback",
  "denDesktopPolicies.status.enabled": "Enabled",
  "denDesktopPolicies.status.disabled": "Disabled",
  "denDesktopPolicies.status.deleted": "Desktop policy deleted.",
  "denDesktopPolicies.status.loading": "Loading desktop policies...",
  "denDesktopPolicies.empty.title": "No desktop policies yet",
  "denDesktopPolicies.empty.description":
    "Create a policy to control which desktop capabilities members can use.",
  "denDesktopPolicies.notice.readOnly": "Read only. {reason}",
  "denDesktopPolicies.notice.featureName": "Desktop policy management",
  "denDesktopPolicies.dialog.deleteConfirm": "Delete {policyName}?",
  "denDesktopPolicies.error.deleteDenied": "You don't have permission to delete desktop policies.",
  "denDesktopPolicies.error.deleteFailed": "Failed to delete desktop policy.",

  // ---------------------------------------------------------- ai gateway ----
  "denGateway.coverageNotice.prefix": "The data does not include uncountable queries, ",
  "denGateway.coverageNotice.link": "read more about it here",
  "denGateway.coverageNotice.suffix": ".",
  "denGateway.coverageNotice.details": "Uncountable query details",
  "denGateway.coverageNotice.categoryUpstreamError": "Provider errors",
  "denGateway.coverageNotice.categoryUpstreamUnreachable": "Connection failures",
  "denGateway.coverageNotice.categoryClientAborted": "Cancellations and interruptions",
  "denGateway.coverageNotice.categoryRejected": "Rejected requests",
  "denGateway.coverageNotice.categoryOk": "Completed without reported usage",
  "denGateway.coverageNotice.countUnavailable": "Unavailable",
  "denGateway.coverageNotice.breakdownNote":
    "Some older records do not retain a breakdown by outcome.",
  "denGateway.coverageNotice.totalSuffix": " There are {count} uncountable queries in this period.",
  "denGateway.coverageNotice.totalUnavailableSuffix": " Their total is also unavailable.",
  "denGateway.coverageNotice.teamMembershipNote":
    "Counts follow current team membership; a query may appear in more than one team.",

  // ------------------------------------------------------------ team page ----
  "denTeam.tabpanel.role": "Role",
  "denTeam.tabpanel.overview": "Overview",
  "denTeam.tabpanel.access": "Access",
  "denTeam.defaultName": "This team",
  "denTeam.overview.noMembers": "This team has no members yet.",
  "denTeam.overview.adminVia": "Admin via {teams}",
  "denTeam.access.desktopAppHeading": "In the desktop app",
  "denTeam.access.heading": "Plugins & connections",
  "denTeam.access.description": "Review what this team can use and where access comes from.",
  "denTeam.access.loading": "Loading team access…",
  "denTeam.access.error": "Could not load team access.",
  "denTeam.column.plugin": "Plugin",
  "denTeam.column.accessVia": "Access via",
  "denTeam.column.role": "Role",
  "denTeam.column.grantedBy": "Granted by",
  "denTeam.access.componentCount.one": "{count} component",
  "denTeam.access.componentCount.other": "{count} components",
  "denTeam.access.revoke": "Revoke",
  "denTeam.access.openCatalog": "Open catalog",
  "denTeam.access.noGrants": "This team has no plugin access yet.",

  // ------------------------------------------------------- plugin access ----
  "denPluginAccess.role.viewer": "Can view (use in chat)",
  "denPluginAccess.role.editor": "Can edit",
  "denPluginAccess.status.loading": "Loading access…",
  "denPluginAccess.grant.removedMember": "Removed member",
  "denPluginAccess.grant.removedTeam": "Removed team",
  "denPluginAccess.grant.creator": "Creator",
  "denPluginAccess.grant.sharedBy": "shared by {by} · {date}",
  "denPluginAccess.empty.onlyYou": "Only you can use this plugin",
  "denPluginAccess.empty.description":
    "Share it with a person or a team to give them instant access in chat.",

  // ---------------------------------------------------------- permissions ----
  "denPermissions.action.allowAll": "Allow all",
  "denPermissions.status.notSaved": "Not saved",

  // ------------------------------------------------------ workflow diagram ----
  "denWorkflow.run.lastRun": "Last run: {date}",
  "denWorkflow.run.succeeded": "Succeeded",
  "denWorkflow.run.failed": "Failed",
  "denWorkflow.run.completed": "This run: ✓ completed",
  "denWorkflow.run.stopped": "This run: ✗ stopped here",
  "denWorkflow.run.skipped": "This run: skipped",
  "denWorkflow.tool.savesResultAs": "Saves the result as ",
  "denWorkflow.input.runsWith": "Runs with:",
  "denWorkflow.technical.fields": "Fields: {fields}",
  "denWorkflow.technical.input": "Input: {input}",
} as const;

export type DenMessageKey = keyof typeof en;

export const denMessagesEn: Record<DenMessageKey, string> = en;

export default denMessagesEn;
