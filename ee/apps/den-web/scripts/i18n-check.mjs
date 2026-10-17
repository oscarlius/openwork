#!/usr/bin/env node
/**
 * i18n:check — the gate the message tables promise in their header comments.
 *
 *   pnpm -C ee/apps/den-web i18n:check
 *
 * Reads `app/_lib/i18n/messages/en.ts` (the schema) and `zh.ts` and asserts:
 *   1. no duplicate key inside either table;
 *   2. the en and zh key sets are exactly equal (typecheck already forces zh to
 *      cover en; this also catches an zh key that en never defined);
 *   3. per key, the `{placeholder}` sets are equal. Den names placeholders in
 *      both cases (`{count}`, `{organizationName}`), so a CamelCase name is not
 *      a defect here;
 *   4. every `{...}` slot in either table is a legal identifier;
 *   5. no zh value is blank;
 *   6. every zh value carries at least one Han character, unless its key is in
 *      NO_HAN_ALLOWLIST below or the value is pure punctuation (a `。` or `·`
 *      fragment is locale-neutral). The allowlist is checked both ways: a key
 *      that is not a brand/protocol name fails, and an allowlisted key that has
 *      since gained Han text fails too, so the exception list cannot quietly
 *      rot.
 *
 * Deliberately dependency-free and it parses the source text rather than
 * importing it: the check must run in CI before any build step, and `en.ts` is
 * TypeScript.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const EN_PATH = fileURLToPath(new URL("../app/_lib/i18n/messages/en.ts", import.meta.url));
const ZH_PATH = fileURLToPath(new URL("../app/_lib/i18n/messages/zh.ts", import.meta.url));

/**
 * Keys whose Chinese entry stays a brand or protocol name and therefore holds no
 * Han character. Keep this list short and named: it is the only place an English
 * value is allowed in the zh table.
 */
const NO_HAN_ALLOWLIST = [
  "denRoot.document.title",
  "denDashboard.document.title",
  "denShell.workspace.defaultOrganizationName",
  "denShell.nav.workbot",
  "denShell.nav.openworkWeb",
  "denShell.nav.badgeMcps",
  "denShell.nav.sso",
  "denShell.nav.scim",
  "denShell.pageTitle.workbot",
  "denShell.pageTitle.openworkWeb",
  "denShell.pageTitle.sso",
  "denShell.pageTitle.scim",
];

/**
 * zh entries that are nothing but punctuation — a sentence-final `。`, a
 * separator. There is no word in them to translate. They are listed by name
 * rather than auto-passed, and an entry that grows real text (or a Latin word)
 * stops being exempt.
 */
const PUNCTUATION_ONLY_ALLOWLIST = ["denGateway.coverageNotice.suffix"];

const HAN_PATTERN = /[\p{Script=Han}]/u;
const LATIN_OR_DIGIT_PATTERN = /[A-Za-z0-9]/;
const PLACEHOLDER_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9]*$/;

/**
 * Pull the `key: "value"` pairs of the `const <name> = { ... }` object literal
 * out of a message table. Hand-written scanner rather than a regex: values span
 * several lines, comments sit between entries, and a `//` inside a URL would
 * fool a line-comment strip.
 */
function readMessageTable(source, tableName) {
  const declaration = source.indexOf(`const ${tableName}`);
  if (declaration === -1) throw new Error(`no \`const ${tableName}\` declaration found`);
  const open = source.indexOf("{", declaration);
  if (open === -1) throw new Error(`\`const ${tableName}\` has no object literal`);

  const entries = [];
  const duplicates = [];
  const seen = new Set();
  let depth = 0;
  let index = open;
  let pendingKey = null;

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (char === "/" && next === "/") {
      const lineEnd = source.indexOf("\n", index);
      index = lineEnd === -1 ? source.length : lineEnd + 1;
      continue;
    }
    if (char === "/" && next === "*") {
      const blockEnd = source.indexOf("*/", index + 2);
      index = blockEnd === -1 ? source.length : blockEnd + 2;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      const text = readQuoted(source, index, char);
      if (depth === 1 && pendingKey === null) {
        pendingKey = { key: text.value, start: index };
      } else if (depth === 1 && pendingKey !== null) {
        const key = pendingKey.key;
        pendingKey = null;
        if (seen.has(key)) duplicates.push(key);
        seen.add(key);
        entries.push({ key, value: text.value });
      } else {
        pendingKey = null;
      }
      index = text.end + 1;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) break;
    }
    if (char === ":" && depth === 1 && pendingKey !== null) {
      index += 1;
      continue;
    }
    if (char === "," && depth === 1) pendingKey = null;
    index += 1;
  }

  if (depth !== 0) throw new Error(`\`const ${tableName}\` object literal never closes`);
  return { entries, duplicates };
}

/** The string body of a quoted literal starting at `start`, and its closing quote index. */
function readQuoted(source, start, quote) {
  let value = "";
  let index = start + 1;
  while (index < source.length) {
    const char = source[index];
    if (char === "\\") {
      const escaped = source[index + 1];
      value += escaped === "n" ? "\n" : escaped === "t" ? "\t" : escaped;
      index += 2;
      continue;
    }
    if (char === quote) return { value, end: index };
    value += char;
    index += 1;
  }
  throw new Error(`unterminated string starting at offset ${start}`);
}

/** Every `{...}` slot in a message, whether or not the name is legal. */
function placeholderSlots(text) {
  const slots = [];
  let index = text.indexOf("{");
  while (index !== -1) {
    const close = text.indexOf("}", index + 1);
    if (close === -1) break;
    slots.push(text.slice(index + 1, close));
    index = text.indexOf("{", close + 1);
  }
  return slots;
}

function sortedNames(text) {
  return placeholderSlots(text)
    .filter((slot) => PLACEHOLDER_NAME_PATTERN.test(slot))
    .sort();
}

const problems = [];
const enTable = readMessageTable(readFileSync(EN_PATH, "utf8"), "en");
const zhTable = readMessageTable(readFileSync(ZH_PATH, "utf8"), "zh");

for (const [name, table] of [["en", enTable], ["zh", zhTable]]) {
  for (const key of table.duplicates) {
    problems.push(`${name}.ts: duplicate key "${key}"`);
  }
}

const en = new Map(enTable.entries.map((entry) => [entry.key, entry.value]));
const zh = new Map(zhTable.entries.map((entry) => [entry.key, entry.value]));

for (const key of en.keys()) {
  if (!zh.has(key)) problems.push(`zh.ts is missing key "${key}"`);
}
for (const key of zh.keys()) {
  if (!en.has(key)) problems.push(`zh.ts declares "${key}", which en.ts (the schema) never defines`);
}

const allowlist = new Set(NO_HAN_ALLOWLIST);
const punctuationAllowlist = new Set(PUNCTUATION_ONLY_ALLOWLIST);
for (const [list, label] of [[allowlist, "brand"], [punctuationAllowlist, "punctuation"]]) {
  for (const key of list) {
    if (!en.has(key)) problems.push(`i18n-check ${label} allowlist names "${key}", which no longer exists`);
  }
}

for (const [key, text] of en) {
  const zhText = zh.get(key);
  if (zhText === undefined) continue;

  if (text.trim() === "") problems.push(`en.ts: "${key}" is blank`);
  if (zhText.trim() === "") problems.push(`zh.ts: "${key}" is blank`);

  for (const [name, value] of [["en", text], ["zh", zhText]]) {
    for (const slot of placeholderSlots(value)) {
      if (!PLACEHOLDER_NAME_PATTERN.test(slot)) {
        problems.push(`${name}.ts: "${key}" has a malformed placeholder "{${slot}}"`);
      }
    }
  }

  const enNames = sortedNames(text);
  const zhNames = sortedNames(zhText);
  if (enNames.join(",") !== zhNames.join(",")) {
    problems.push(
      `"${key}" placeholders differ — en {${enNames.join(", ")}} vs zh {${zhNames.join(", ")}}`,
    );
  }

  const hasHan = HAN_PATTERN.test(zhText);
  const exempt = allowlist.has(key) || punctuationAllowlist.has(key);
  if (!hasHan && !exempt) {
    problems.push(`zh.ts: "${key}" holds no Chinese text ("${zhText}") and is not allowlisted`);
  }
  if (hasHan && exempt) {
    problems.push(
      `i18n-check: "${key}" is allowlisted as untranslated, but zh.ts now translates it — drop the exception`,
    );
  }
  if (punctuationAllowlist.has(key)) {
    const withoutPlaceholders = zhText.replace(/\{[A-Za-z0-9]*\}/g, "");
    if (LATIN_OR_DIGIT_PATTERN.test(withoutPlaceholders)) {
      problems.push(
        `i18n-check: "${key}" is allowlisted as punctuation-only, but zh.ts gives it real text — move it to the brand list or translate it`,
      );
    }
  }
}

const keyCount = en.size;
if (problems.length > 0) {
  console.error(`i18n:check FAILED (${problems.length} problem(s) across ${keyCount} keys)`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(
  `i18n:check ok — ${keyCount} keys, en/zh key sets equal, placeholders aligned, ` +
    `${allowlist.size} brand/protocol names and ${punctuationAllowlist.size} punctuation fragments ` +
    `allowlisted as carrying no Han text.`,
);
