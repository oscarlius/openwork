"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  DEFAULT_DEN_LOCALE,
  DEN_LOCALE_COOKIE,
  DEN_LOCALE_COOKIE_MAX_AGE_SECONDS,
  denHtmlLang,
  normalizeDenLocale,
  rememberDenLocale,
  type DenLocale,
} from "./den-locale";
import { createDenT, type DenTranslate } from "./messages";

const DenLocaleContext = createContext<DenLocale>(DEFAULT_DEN_LOCALE);

/**
 * Bound by the root layout (a server component) to the locale it resolved from
 * the cookie and the `denLocaleSelection` gate. Client components read the same
 * message tables the server used, so server and client markup agree.
 */
export function DenMessagesProvider({
  locale,
  children,
}: {
  locale: DenLocale;
  children: React.ReactNode;
}) {
  const value = normalizeDenLocale(locale);
  return <DenLocaleContext.Provider value={value}>{children}</DenLocaleContext.Provider>;
}

/** The locale this component tree is rendering in. */
export function useDenLocale(): DenLocale {
  return normalizeDenLocale(useContext(DenLocaleContext));
}

/**
 * `t(key, params?)` for client components — identical signature, keys and
 * `{placeholder}` set as the server-side `createDenT(await resolveDenLocale())`.
 */
export function useDenT(): DenTranslate {
  const locale = useDenLocale();
  return useMemo(() => createDenT(locale), [locale]);
}

/**
 * Keeps the browser honest about the resolved locale: syncs `<html lang>` for
 * client-side navigations, and drops a cookie the server refused to honour (the
 * feature was switched off, or the value was never a locale) so a reverted
 * rollout clears itself rather than lingering on every person's browser.
 */
export function DenLocaleBootstrap({ stale }: { stale: boolean }) {
  const locale = useDenLocale();

  useEffect(() => {
    rememberDenLocale(locale);
    if (document.documentElement.getAttribute("lang") !== denHtmlLang(locale)) {
      document.documentElement.setAttribute("lang", denHtmlLang(locale));
    }
  }, [locale]);

  useEffect(() => {
    if (!stale) return;
    document.cookie = `${DEN_LOCALE_COOKIE}=; path=/; max-age=0; samesite=lax`;
  }, [stale]);

  return null;
}

/**
 * Records the choice on this browser and asks the server to re-render the current
 * route in it. Values other than "en" and "zh" never reach the cookie.
 */
export function useSetDenLocale(): (locale: DenLocale) => void {
  const router = useRouter();
  const [, startTransition] = useTransition();

  return useCallback((locale: DenLocale) => {
    const next = normalizeDenLocale(locale);
    const current = normalizeDenLocale(
      document.cookie.split("; ").find((entry) => entry.startsWith(`${DEN_LOCALE_COOKIE}=`))
        ?.slice(DEN_LOCALE_COOKIE.length + 1),
    );
    if (next === current) {
      return;
    }

    document.cookie =
      `${DEN_LOCALE_COOKIE}=${next}; path=/; max-age=${DEN_LOCALE_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
    startTransition(() => {
      router.refresh();
    });
  }, [router]);
}
