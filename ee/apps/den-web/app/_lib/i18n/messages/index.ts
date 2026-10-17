import { DEFAULT_DEN_LOCALE, denPluralChoice, type DenLocale } from "../den-locale";
import denMessagesEn, { type DenMessageKey } from "./en";
import denMessagesZh from "./zh";

export type { DenMessageKey } from "./en";

/** Values substituted into `{placeholder}` slots. */
export type DenMessageParams = Record<string, string | number>;

/**
 * Keys that only exist as `.zero` / `.one` / `.other` variants. Pass the base key
 * with a numeric `count` param and the right variant is picked:
 * `t("denShell.memberCount", { count: 3 })`.
 *
 * The conditional type has to run over each member of `DenMessageKey`
 * individually, so it lives behind a type parameter; written inline on the alias
 * itself it would test the whole union at once and collapse to `never`.
 */
type DenPluralVariant = "zero" | "one" | "two" | "few" | "many" | "other";
type DenPluralBaseFor<Key extends DenMessageKey> = Key extends `${infer Base}.${DenPluralVariant}`
  ? Base
  : never;
export type DenPluralBaseKey = DenPluralBaseFor<DenMessageKey>;

/** Anything `t()` accepts: a plain key, or a plural base key. */
export type DenTranslatableKey = DenMessageKey | DenPluralBaseKey;

/**
 * The call signature every translated file uses, on both the server and the
 * client: `t(key)` or `t(key, { name: value })`.
 */
export type DenTranslate = (key: DenTranslatableKey, params?: DenMessageParams) => string;

type DenMessageTable = Record<DenMessageKey, string>;

const DEN_MESSAGE_TABLES: Record<DenLocale, DenMessageTable> = {
  en: denMessagesEn,
  zh: denMessagesZh,
};

/** Every key, in declaration order. Used by `pnpm -C ee/apps/den-web i18n:check`. */
export const DEN_MESSAGE_KEYS: DenMessageKey[] = Object.keys(denMessagesEn).filter(isDenMessageKey);

const DEN_MESSAGE_KEY_SET = new Set<string>(DEN_MESSAGE_KEYS);

/** Runtime check for a key that really is in the schema (`en.ts`). */
export function isDenMessageKey(value: string): value is DenMessageKey {
  return DEN_MESSAGE_KEY_SET.has(value);
}

/**
 * `{placeholder}` names inside a message, in order of first appearance. Den
 * messages use both `{lowercase}` and `{CamelCase}` names, so neither is
 * rejected here.
 */
export function denMessagePlaceholders(text: string): string[] {
  const found: string[] = [];
  const pattern = /\{([A-Za-z][A-Za-z0-9]*)\}/g;
  let match = pattern.exec(text);
  while (match !== null) {
    if (!found.includes(match[1]!)) found.push(match[1]!);
    match = pattern.exec(text);
  }
  return found;
}

/** A message body, or `null` when this table does not carry this key. */
function denMessageEntry(table: DenMessageTable, key: DenTranslatableKey): string | null {
  if (!isDenMessageKey(key)) return null;
  const value: string | undefined = table[key];
  return value === undefined ? null : value;
}

/**
 * Resolve a requested key to a key that actually exists: the count variant for
 * this locale first, then `.other`, then the key as written. English has two
 * forms; Simplified Chinese has one, so its `.one` and `.other` entries simply
 * carry the same wording and the lookup still lands. Mirrors
 * `apps/app/src/i18n/index.ts` `resolvePluralKey`.
 */
function resolveDenMessageKey(
  locale: DenLocale,
  key: DenTranslatableKey,
  count: number,
): DenTranslatableKey {
  const candidates: string[] = [
    ...(count === 0 ? [`${key}.zero`] : []),
    `${key}.${denPluralChoice(count, locale)}`,
    `${key}.other`,
    key,
  ];
  const table = DEN_MESSAGE_TABLES[locale];
  for (const candidate of candidates) {
    if (isDenMessageKey(candidate) && denMessageEntry(table, candidate) !== null) {
      return candidate;
    }
  }
  return key;
}

/**
 * Substitute `{name}` slots. A placeholder the caller did not supply is left
 * exactly as written, so a missing parameter shows up as visible `{name}` in
 * the review screenshot instead of silently deleting words.
 *
 * Without a numeric `count` the key is used verbatim, exactly as it was before
 * plural support existed, so no existing call site changes what it renders.
 */
export function formatDenMessage(
  locale: DenLocale,
  key: DenTranslatableKey,
  params?: DenMessageParams,
): string {
  const table = DEN_MESSAGE_TABLES[locale] ?? DEN_MESSAGE_TABLES[DEFAULT_DEN_LOCALE];
  const englishTable = DEN_MESSAGE_TABLES[DEFAULT_DEN_LOCALE];
  const count = typeof params?.count === "number" ? params.count : undefined;
  const resolvedKey = count === undefined ? key : resolveDenMessageKey(locale, key, count);
  const template =
    denMessageEntry(table, resolvedKey)
    ?? denMessageEntry(englishTable, resolvedKey)
    ?? resolvedKey;
  if (!params) return template;

  let output = template;
  for (const [name, value] of Object.entries(params)) {
    output = output.split(`{${name}}`).join(String(value));
  }
  return output;
}

/**
 * A translator bound to one locale.
 *
 * Server components: `const t = createDenT(await resolveDenLocale())`.
 * Client components: `const t = useDenT()` (same signature, same tables).
 */
export function createDenT(locale: DenLocale): DenTranslate {
  return (key, params) => formatDenMessage(locale, key, params);
}
