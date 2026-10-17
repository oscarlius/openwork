// Main-process locale state for native surfaces (application menu, native
// context menus). The renderer owns the user's language preference
// (localStorage key "openwork.language", apps/app/src/i18n/index.ts); it
// announces the active value over the "openwork:locale:set" IPC channel and
// the menu is rebuilt from the dictionaries in native-menu-labels.mjs.
//
// Default policy: English everywhere the locale is unknown or unrecognized.
// Only unambiguous Simplified Chinese (the renderer's "zh" choice, or a
// system tag in zh-Hans / zh-CN / zh-SG) selects the zh dictionary;
// Traditional variants (zh-Hant, zh-TW, zh-HK, zh-MO) keep English because
// this dictionary is Simplified. All other renderer languages
// (ja|vi|pt-BR|th|fr|ca|es|ru) map to English native menus.

import { NATIVE_MENU_LABELS } from "./native-menu-labels.mjs";

/** @typedef {import("./native-menu-labels.mjs").NativeMenuLocale} NativeMenuLocale */

/** @type {NativeMenuLocale} */
let currentNativeLocale = "en";

/**
 * Map any renderer language value or system locale tag to "en" or "zh".
 * Never throws and never returns a locale outside the dictionary set.
 * @param {unknown} value
 * @returns {NativeMenuLocale}
 */
export function normalizeNativeLocale(value) {
  if (typeof value !== "string") return "en";
  const tag = value.trim().toLowerCase().replace(/_/g, "-");
  if (!tag) return "en";
  if (tag === "zh") return "zh";
  if (tag.startsWith("zh-hans")) return "zh";
  if (tag === "zh-cn" || tag === "zh-sg") return "zh";
  return "en";
}

/**
 * Store the active native-menu locale.
 * @param {unknown} value renderer language value or system locale tag
 * @returns {NativeMenuLocale} the locale actually applied
 */
export function setNativeLocale(value) {
  currentNativeLocale = normalizeNativeLocale(value);
  return currentNativeLocale;
}

/** @returns {NativeMenuLocale} */
export function getNativeLocale() {
  return currentNativeLocale;
}

/**
 * Resolve a label for the active locale, falling back to English and then to
 * the key itself so a missing entry can never render an empty menu item.
 * @param {string} key
 * @returns {string}
 */
export function t(key) {
  const dict = NATIVE_MENU_LABELS[currentNativeLocale] ?? NATIVE_MENU_LABELS.en;
  return dict[key] ?? NATIVE_MENU_LABELS.en[key] ?? key;
}
