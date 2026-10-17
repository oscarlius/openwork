"use client";

import { useDenLocale, useSetDenLocale, useDenT } from "../../../_lib/i18n/client";
import { DEN_LOCALE_OPTIONS } from "../../../_lib/i18n/den-locale";

/**
 * The only entry point that can change the console's language, and the only
 * writer of the `openwork.den.locale` cookie.
 *
 * Render it behind the registry gate, never here:
 * `orgFeatureEnabled(orgContext, "denLocaleSelection") ? <DenLanguageSwitcher /> : null`
 * (see `app/(den)/dashboard/_components/org-dashboard-shell.tsx`). Keeping the
 * check at the call site means turning the feature off removes the control from
 * the account area in the same request, with no deploy.
 *
 * Language names are shown in their own language on purpose — that is the one
 * string set that must not be translated, so it lives beside the locale model
 * rather than in the message tables.
 */
export function DenLanguageSwitcher() {
  const t = useDenT();
  const locale = useDenLocale();
  const setLocale = useSetDenLocale();

  return (
    <div className="mt-1 flex items-center justify-between gap-3 rounded-xl px-2 py-1.5">
      <label
        htmlFor="den-language-select"
        className="shrink-0 text-[12px] font-medium text-gray-500"
      >
        {t("denShell.language.label")}
      </label>
      <select
        id="den-language-select"
        value={locale}
        onChange={(event) => setLocale(event.currentTarget.value === "zh" ? "zh" : "en")}
        aria-label={t("denShell.language.selectLabel")}
        data-testid="den-language-select"
        className="min-w-0 shrink rounded-lg border border-gray-200 bg-white px-2 py-1 text-[12px] text-gray-900 outline-hidden transition focus:border-gray-400"
      >
        {DEN_LOCALE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
