/**
 * The locale seam for OpenWork Den (ee/apps/den-web).
 *
 * Read `GLOSSARY.md` in this folder before adding messages: it carries the key
 * naming rules, the prefix allocation table and the terminology list every
 * translated string must follow.
 *
 * Hard rules:
 *  - `en` is the only default. No cookie, an unknown cookie value, an
 *    unreachable feature gate or a failed fetch all resolve to `en`.
 *  - `denLocaleSelection` (packages/features/src/registry.ts) gates the whole
 *    feature. While it is off the cookie is ignored *and* removed, so a kill
 *    switch reverts every page without a deploy.
 */

export const DEN_LOCALES = ["en", "zh"] as const;

export type DenLocale = (typeof DEN_LOCALES)[number];

export const DEFAULT_DEN_LOCALE: DenLocale = "en";

/** The only value a person can pick besides English. */
export const SIMPLIFIED_CHINESE_LOCALE: DenLocale = "zh";

/** Cookie name holding the choice. Same name is read on the server and in the browser. */
export const DEN_LOCALE_COOKIE = "openwork.den.locale";

/** Cookie lifetime: a year, long enough that nobody re-picks it every session. */
export const DEN_LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const DEN_LOCALE_OPTIONS: ReadonlyArray<{ value: DenLocale; label: string }> = [
  { value: "en", label: "English" },
  { value: "zh", label: "简体中文" },
];

/** Type guard: is this a locale this app can render? */
export function isDenLocale(value: unknown): value is DenLocale {
  return typeof value === "string" && (DEN_LOCALES as readonly string[]).includes(value);
}

/**
 * Fail closed to `en`. Anything unrecognized (including a hand-edited cookie)
 * renders exactly what the app rendered before Simplified Chinese existed.
 */
export function normalizeDenLocale(value: unknown): DenLocale {
  return isDenLocale(value) ? value : DEFAULT_DEN_LOCALE;
}

/**
 * The `Intl` locale tag for a UI locale.
 *
 * `englishFallback` is the literal the call site used before i18n ("en-US" in
 * most files, "en" in a few). Returning it untouched for `en` keeps every
 * formatted date and number byte-for-byte identical to today; only `zh` swaps
 * to "zh-CN".
 */
export function denIntlLocale(locale: DenLocale, englishFallback: "en-US" | "en"): string {
  return locale === SIMPLIFIED_CHINESE_LOCALE ? "zh-CN" : englishFallback;
}

/**
 * Which grammatical number a count selects, per locale, following the same
 * `Intl.PluralRules` convention as `apps/app/src/i18n/index.ts`.
 *
 * English has two forms (`one` / `other`); Simplified Chinese has one, so every
 * count selects `other` and its `.one` / `.other` entries simply carry the same
 * wording. A later locale needs no code here at all.
 */
const DEN_PLURAL_RULES: Record<DenLocale, Intl.PluralRules> = {
  en: new Intl.PluralRules("en"),
  zh: new Intl.PluralRules("zh-CN"),
};

export function denPluralChoice(count: number, locale: DenLocale): Intl.LDMLPluralRule {
  return DEN_PLURAL_RULES[locale].select(count);
}

/**
 * The browser-facing html `lang` value. Browsers and screen readers prefer the
 * region tag for Simplified Chinese.
 */
export function denHtmlLang(locale: DenLocale): string {
  return locale === SIMPLIFIED_CHINESE_LOCALE ? "zh-CN" : "en";
}

/**
 * The locale the root layout actually rendered with, mirrored on the window so
 * the last-resort client boundary (`app/global-error.tsx`) can agree with it.
 * This is the server's gated answer, never the raw cookie, so a rollout that is
 * off cannot leak a non-English lang even when the root layout itself threw.
 */
declare global {
  interface Window {
    __openworkDenLocale?: DenLocale;
  }
}

/** Mirror the server-resolved locale for browser-only boundaries. */
export function rememberDenLocale(locale: DenLocale): void {
  if (typeof window !== "undefined") {
    window.__openworkDenLocale = normalizeDenLocale(locale);
  }
}

/** The last rendered locale, or `en` when nothing has rendered yet. */
export function readRememberedDenLocale(): DenLocale {
  if (typeof window === "undefined") {
    return DEFAULT_DEN_LOCALE;
  }
  return normalizeDenLocale(window.__openworkDenLocale);
}
