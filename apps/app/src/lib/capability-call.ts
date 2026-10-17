import type { DynamicToolUIPart } from "ai"
import { t } from "../i18n"

/**
 * Paper rendering rules — "Capability calls → sentences":
 * never render raw JSON. Map connection name → service ("Granola"),
 * tool name → verb ("Asking about…"), body.query → quoted plain text.
 * IDs and schema digests live under "Technical details", collapsed.
 *
 * Every display line resolves through `t()` when it renders, never at module
 * load, so switching language takes effect immediately. The lookup keys stay
 * English because they come from tool names, not from prose.
 */

export type CapabilityCallSentence = {
  /** Human service name, e.g. "Granola" or "OpenWork Cloud". */
  service: string | null
  /** Present-tense line while the call runs. */
  present: string
  /** Past-tense line once the call completed. */
  past: string
  failure?: string
}

/** Tool-name verb slug → past-tense catalogue key. */
const PAST_TENSE_KEYS: Record<string, string> = {
  ask: "status.cap_past_ask",
  search: "status.cap_past_search",
  find: "status.cap_past_find",
  get: "status.cap_past_get",
  fetch: "status.cap_past_get",
  list: "status.cap_past_list",
  read: "status.cap_past_read",
  check: "status.cap_past_check",
  create: "status.cap_past_create",
  add: "plugins.added",
  send: "status.cap_past_send",
  update: "status.cap_past_update",
  delete: "status.cap_past_delete",
  remove: "status.cap_past_remove",
  execute: "status.cap_past_execute",
  run: "status.cap_past_execute",
  open: "status.cap_past_open",
  query: "status.cap_past_query",
}

/** Tool-name verb slug → present-tense catalogue key. */
const PRESENT_TENSE_KEYS: Record<string, string> = {
  ask: "status.cap_present_ask",
  search: "status.cap_present_search",
  find: "status.cap_present_find",
  get: "status.cap_present_get",
  fetch: "status.cap_present_get",
  list: "status.cap_present_list",
  read: "status.cap_present_read",
  check: "status.cap_present_check",
  create: "status.cap_present_create",
  add: "status.cap_present_add",
  send: "status.cap_present_send",
  update: "status.cap_present_update",
  delete: "status.cap_present_delete",
  remove: "status.cap_present_remove",
  execute: "status.running",
  run: "status.running",
  open: "status.cap_present_open",
  query: "status.cap_present_query",
}

/** Capability output kinds that have a localized name in the catalogue. */
const KIND_KEYS: Record<string, string> = {
  skill: "activity.kind_skill",
  plugin: "activity.kind_plugin",
}

function pastTenseWord(word: string): string | undefined {
  const key = PAST_TENSE_KEYS[word.toLowerCase()]
  return key === undefined ? undefined : t(key)
}

function presentTenseWord(word: string): string | undefined {
  const key = PRESENT_TENSE_KEYS[word.toLowerCase()]
  return key === undefined ? undefined : t(key)
}

function isKnownPastVerb(word: string): boolean {
  return PAST_TENSE_KEYS[word.toLowerCase()] !== undefined
}

function kindLabel(kind: string): string {
  const key = KIND_KEYS[kind.toLowerCase()]
  return key === undefined ? kind : t(key)
}

/** "Couldn’t {verb} {service}" key for a bare search/find/query tool. */
function couldntVerbKey(verb: string): string {
  if (verb === "find") return "status.cap_couldnt_find"
  if (verb === "query") return "status.cap_couldnt_query"
  return "status.cap_couldnt_search"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Tool outputs arrive as objects or JSON strings depending on transport. */
export function parseRecord(value: unknown): Record<string, unknown> | null {
  if (isRecord(value)) return value
  if (typeof value !== "string") return null
  try {
    const parsed: unknown = JSON.parse(value)
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Brand names whose casing a plain title case would get wrong. */
const BRAND_WORDS: Record<string, string> = { openwork: "OpenWork", github: "GitHub", gitlab: "GitLab", hubspot: "HubSpot" }

function titleCase(slug: string): string {
  return slug
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map((word) => BRAND_WORDS[word.toLowerCase()] ?? word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

/**
 * Connection namespaces carry routing ids ("openwork-direct-slack-c1ca24").
 * People should see the service ("Slack"), never the plumbing around it.
 */
export function serviceNameFromSlug(slug: string): string {
  const cleaned = slug.replace(/^openwork-direct-/i, "").replace(/-[0-9a-f]{6}$/i, "")
  return titleCase(cleaned || slug)
}

/**
 * Tool actions often repeat their service and lead with a qualifier
 * ("web_search_exa"). Drop the repeated service word, and move a known verb
 * to the front so "web_search" reads as "search web".
 */
function normalizeAction(action: string, serviceSlug: string): string {
  const serviceWords = new Set(serviceSlug.toLowerCase().split(/[-_.\s]+/))
  const words = action.split(/[-_.\s]+/).filter(Boolean)
  const withoutService = words.filter((word) => !serviceWords.has(word.toLowerCase()))
  const kept = withoutService.length > 0 ? withoutService : words
  const verbIndex = kept.findIndex((word) => isKnownPastVerb(word))
  if (verbIndex > 0) kept.unshift(...kept.splice(verbIndex, 1))
  return kept.join("_")
}

/** "list_files" → "list files", for "Couldn't list files". */
function baseVerbPhrase(action: string): string {
  return humanize(action).toLowerCase()
}

function humanize(slug: string): string {
  return slug.split(/[-_.\s]+/).filter(Boolean).join(" ")
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/** Pull a short human query out of a capability call input, if one exists. */
function extractQuery(input: unknown, max = 80): string | null {
  if (!isRecord(input)) return null
  const direct = input.query ?? input.q ?? input.search ?? input.prompt
  if (typeof direct === "string" && direct.trim()) return truncate(direct.trim(), max)
  // Bodies arrive as objects or as a JSON string, depending on how the
  // capability was invoked.
  const body = parseRecord(input.body)
  if (body) {
    const nested = body.query ?? body.q ?? body.search ?? body.prompt ?? body.question ?? body.message ?? body.text
    if (typeof nested === "string" && nested.trim()) return truncate(nested.trim(), max)
  }
  return null
}

/**
 * Full natural-language ask behind a capability call, for the failed-call
 * card's quote block (Paper "Failed Call Card" · Query Quote).
 */
export function getCapabilityCallQuote(part: DynamicToolUIPart): string | null {
  return extractQuery(part.input, 280)
}

/** "granola.ask-about-meetings" or "granola/ask_about_meetings" → parts. */
function splitCapabilityName(name: string): { service: string; action: string } | null {
  const separator = name.includes(".") ? "." : name.includes("/") ? "/" : null
  if (!separator) return null
  const index = name.indexOf(separator)
  const service = name.slice(0, index)
  const action = name.slice(index + 1)
  if (!service || !action) return null
  return { service: serviceNameFromSlug(service), action }
}

function verbPhrase(action: string, tense: "present" | "past"): string {
  const words = action.split(/[-_.\s]+/).filter(Boolean)
  const first = words[0]?.toLowerCase()
  const mapped = first ? (tense === "past" ? pastTenseWord(first) : presentTenseWord(first)) : undefined
  if (mapped) {
    return [mapped, ...words.slice(1)].join(" ")
  }
  const prefix = tense === "past" ? t("status.cap_used_verb") : t("status.cap_using_verb")
  return `${prefix} ${humanize(action)}`
}

/**
 * "{verb} {service}" for a bare search/find/query tool, with the localized
 * query tail when the call carried one. The verb word comes from the tables.
 */
function searchLine(verb: string, tense: "present" | "past", service: string, tail: string): string {
  const word = (tense === "past" ? pastTenseWord(verb) : presentTenseWord(verb)) ?? humanize(verb)
  return `${word} ${service}${tail}`
}

/** Skill slug from a get_skill call: the name asked for, else the one returned. */
function skillReference(part: DynamicToolUIPart): string | null {
  const input = parseRecord(part.input)
  const asked = typeof input?.name === "string" ? input.name.trim() : ""
  if (asked && !asked.includes(":")) return asked
  const raw = "output" in part ? part.output : undefined
  const output = parseRecord(raw)
  if (typeof output?.name === "string" && output.name.trim()) return output.name.trim()
  // The text result is the SKILL.md itself; its frontmatter carries the slug.
  const frontmatter = typeof raw === "string" ? /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw)?.[1] : undefined
  const name = frontmatter ? /^name:\s*(.+)$/m.exec(frontmatter)?.[1]?.trim() ?? "" : ""
  // Den keeps marketplace skill names unique with an 8-character id suffix.
  return (asked.startsWith("plugin:") ? name.replace(/-[a-z0-9]{8}$/, "") : name) || null
}

export function getConnectionStatusProbeId(part: DynamicToolUIPart): string | null {
  if (part.toolName !== "openwork_execute_capability" && part.toolName !== "openwork-cloud_execute_capability") return null
  const input = parseRecord(part.input)
  return typeof input?.name === "string" ? /^mcp:([^:\s]+):\*$/.exec(input.name)?.[1] ?? null : null
}

export function getCapabilityCallSentence(
  part: DynamicToolUIPart,
  options?: { includeQuery?: boolean; connectionName?: string | null },
): CapabilityCallSentence {
  const toolName = part.toolName
  if (getConnectionStatusProbeId(part)) {
    const service = options?.connectionName?.trim() || null
    const target = service ? t("status.cap_target_named", { name: service }) : t("status.cap_target_unnamed")
    return {
      service,
      present: t("status.cap_probe_present", { target }),
      past: t("status.cap_probe_past", { target }),
      failure: t("status.cap_probe_failure", { target }),
    }
  }
  if (toolName.endsWith("_get_skill")) {
    const name = skillReference(part)
    const target = name ? t("status.cap_skill_target_named", { name }) : t("status.cap_skill_target_unnamed")
    return {
      service: null,
      present: t("status.cap_use_present", { target }),
      past: t("status.cap_use_past", { target }),
      failure: t("status.cap_use_failure", { target }),
    }
  }

  if (toolName.endsWith("_list_skills")) {
    return { service: null, present: t("status.cap_list_skills_present"), past: t("status.cap_list_skills_past") }
  }

  // Code Mode's own catalog lookup is plumbing: say what it did, never echo
  // the internal tool name it searched for.
  if (toolName === "search") {
    return {
      service: null,
      present: t("status.cap_probe_tools_present"),
      past: t("status.cap_probe_tools_past"),
      failure: t("status.cap_probe_tools_failure"),
    }
  }

  const query = options?.includeQuery === false ? null : extractQuery(part.input)
  const quoted = query ? `“${query}”` : ""
  const forTail = quoted ? t("status.cap_query_for_tail", { query: quoted }) : ""
  const colonTail = quoted ? t("status.cap_query_colon_tail", { query: quoted }) : ""

  if (toolName.endsWith("search_capabilities")) {
    return {
      service: null,
      present: quoted
        ? t("status.cap_search_conns_present_query", { query: quoted })
        : t("status.cap_search_conns_present"),
      past: quoted
        ? t("status.cap_search_conns_past_query", { query: quoted })
        : t("status.cap_search_conns_past"),
      failure: t("status.cap_search_conns_failure"),
    }
  }

  // A Den Code Mode script: the work happens inside the script, so name the
  // place it ran rather than the plumbing tool ("execute capability script").
  if (toolName.endsWith("execute_capability_script")) {
    const service = "OpenWork Cloud"
    return {
      service,
      present: t("status.cap_script_present", { service }),
      past: t("status.cap_script_past", { service }),
      failure: t("status.cap_script_failure", { service }),
    }
  }

  if (toolName.endsWith("execute_capability")) {
    const name = isRecord(part.input) && typeof part.input.name === "string" ? part.input.name : null
    const split = name ? splitCapabilityName(name) : null
    if (split) {
      return {
        service: split.service,
        present: `${verbPhrase(split.action, "present")} · ${split.service}${colonTail}`,
        past: `${verbPhrase(split.action, "past")} · ${split.service}${colonTail}`,
        failure: t("status.cap_couldnt", {
          action: baseVerbPhrase(split.action),
          tail: ` · ${split.service}`,
        }),
      }
    }

    // Org MCP capabilities arrive as "mcp:<connection-id>:<tool_name>". The
    // connection id is opaque, so the trailing tool name carries the meaning
    // ("query_granola_meetings" → "Queried granola meetings").
    if (name?.startsWith("mcp:")) {
      const rawAction = name.split(":").filter(Boolean).at(-1)
      if (rawAction) {
        // The connection id is opaque; the resolved connector names the service.
        const service = options?.connectionName?.trim() || null
        const action = normalizeAction(rawAction, service ?? "")
        if (service && /^(?:search|find|query)(?:_|$)/i.test(action)) {
          const verb = action.split("_")[0]!.toLowerCase()
          return {
            service,
            present: searchLine(verb, "present", service, forTail),
            past: searchLine(verb, "past", service, forTail),
            failure: t(couldntVerbKey(verb), { service }),
          }
        }
        const tail = service ? ` · ${service}` : ""
        return {
          service,
          present: `${verbPhrase(action, "present")}${tail}${colonTail}`,
          past: `${verbPhrase(action, "past")}${tail}${colonTail}`,
          // Without a known service there is nothing specific to say.
          ...(service
            ? { failure: t("status.cap_couldnt", { action: baseVerbPhrase(action), tail }) }
            : {}),
        }
      }
    }

    // "plugin:plg_…:cob_…" refs are opaque; the human name only exists in
    // the output ({ kind: "skill", plugin: "Plan My Day", … }).
    if (name?.startsWith("plugin:")) {
      const output = parseRecord("output" in part ? part.output : undefined)
      const kind = typeof output?.kind === "string" ? output.kind : "plugin"
      const pluginName = typeof output?.plugin === "string"
        ? output.plugin
        : typeof output?.name === "string"
          ? humanize(output.name)
          : null
      const label = pluginName
        ? t("status.cap_kind_named", { kind: kindLabel(kind), name: `“${pluginName}”` })
        : t("status.cap_kind_generic", { kind: kindLabel(kind) })
      return {
        service: pluginName,
        present: t("status.cap_using_target", { target: label }),
        past: t("status.cap_used_target", { target: label }),
      }
    }

    // Native camelCase capabilities, e.g.
    // "native:<connection>:getCapabilitiesGoogleWorkspaceCalendarEvents".
    if (name) {
      const nativeName = name.replace(/^native:[^:]+:/, "")
      const words = nativeName.split(/(?=[A-Z])|[-_.\s]+/).filter(Boolean)
      const first = words[0]?.toLowerCase()
      const verbPast = first ? pastTenseWord(first) : undefined
      const verbPresent = first ? presentTenseWord(first) : undefined
      let rest = words.slice(1)
      if (/^capabilit(y|ies)$/i.test(rest[0] ?? "")) rest = rest.slice(1)
      // "GoogleWorkspaceCalendarEvents" → service "Google Workspace", "calendar events".
      const nativeService = /^GoogleWorkspace/.test(rest.join("")) ? "Google Workspace"
        : /^Microsoft365/.test(rest.join("")) ? "Microsoft 365" : null
      if (nativeService) rest = rest.slice(nativeService === "Google Workspace" ? 2 : 1)
      if (first && verbPast && verbPresent && rest.length > 0) {
        const phrase = rest.join(" ").toLowerCase()
        const suffix = nativeService ? ` · ${nativeService}` : ""
        return {
          service: nativeService,
          present: `${verbPresent} ${phrase}${suffix}`,
          past: `${verbPast} ${phrase}${suffix}`,
          failure: t("status.cap_couldnt", { action: `${first} ${phrase}`, tail: suffix }),
        }
      }
    }

    return {
      service: null,
      present: quoted ? t("status.cap_generic_present_query", { query: quoted }) : t("status.cap_generic_present"),
      past: quoted ? t("status.cap_generic_past_query", { query: quoted }) : t("status.cap_generic_past"),
    }
  }

  // Generic "{connection}_{tool}" MCP tools.
  const underscore = toolName.indexOf("_")
  if (underscore > 0) {
    const serviceSlug = toolName.slice(0, underscore)
    const service = serviceNameFromSlug(serviceSlug)
    const action = normalizeAction(toolName.slice(underscore + 1), serviceSlug)
    // A bare search reads as "Searched Exa", not "Searched · Exa".
    // Search qualifiers ("search_public_and_private", "web_search") add
    // nothing a person needs; the query says what was searched.
    if (/^(?:search|find|query)(?:_|$)/i.test(action)) {
      const verb = action.split("_")[0]!.toLowerCase()
      return {
        service,
        present: searchLine(verb, "present", service, forTail),
        past: searchLine(verb, "past", service, forTail),
        failure: t(couldntVerbKey(verb), { service }),
      }
    }
    return {
      service,
      present: `${verbPhrase(action, "present")} · ${service}${colonTail}`,
      past: `${verbPhrase(action, "past")} · ${service}${colonTail}`,
      failure: t("status.cap_couldnt", { action: baseVerbPhrase(action), tail: ` · ${service}` }),
    }
  }

  return {
    service: null,
    present: `${verbPhrase(toolName, "present")}${colonTail}`,
    past: `${verbPhrase(toolName, "past")}${colonTail}`,
  }
}
