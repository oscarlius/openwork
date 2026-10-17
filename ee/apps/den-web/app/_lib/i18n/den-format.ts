import { DEFAULT_DEN_LOCALE, denIntlLocale, type DenLocale } from "./den-locale";

/**
 * `Intl` wrappers used by every translated screen.
 *
 * The rule that keeps the English path byte-identical: each helper takes
 * `englishLocale`, the literal the call site passed before i18n existed
 * ("en-US" in most of this app, "en" in a few), and returns it unchanged for
 * `en`. Only `zh` substitutes "zh-CN". Call sites keep passing the same options
 * object, so nothing about an English render moves.
 */

export function formatDenDateTime(
  locale: DenLocale,
  value: Date,
  options: Intl.DateTimeFormatOptions,
  englishLocale: "en-US" | "en" = "en-US",
): string {
  return new Intl.DateTimeFormat(denIntlLocale(locale, englishLocale), options).format(value);
}

export function formatDenNumber(
  locale: DenLocale,
  value: number,
  options: Intl.NumberFormatOptions,
  englishLocale: "en-US" | "en" = "en-US",
): string {
  return new Intl.NumberFormat(denIntlLocale(locale, englishLocale), options).format(value);
}

/**
 * For call sites that used `date.toLocaleDateString(undefined, …)` — the runtime
 * default locale. English keeps that exact bare call so its output cannot shift;
 * only Simplified Chinese pins the tag.
 */
export function formatDenLocaleDate(
  locale: DenLocale,
  value: Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  return locale === DEFAULT_DEN_LOCALE
    ? value.toLocaleDateString(undefined, options)
    : value.toLocaleDateString(denIntlLocale(locale, "en-US"), options);
}

/** Same guard for a bare `date.toLocaleString()`. */
export function formatDenLocaleDateTime(locale: DenLocale, value: Date): string {
  return locale === DEFAULT_DEN_LOCALE
    ? value.toLocaleString()
    : value.toLocaleString(denIntlLocale(locale, "en-US"));
}

/**
 * Plain grouped integer. For `en` this is the bare `toLocaleString()` call the
 * code already made (runtime default locale), so the output cannot drift.
 */
export function formatDenCount(locale: DenLocale, value: number): string {
  return locale === DEFAULT_DEN_LOCALE
    ? value.toLocaleString()
    : value.toLocaleString(denIntlLocale(locale, "en-US"));
}
