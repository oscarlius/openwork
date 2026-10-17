/**
 * Server-only: reads the request cookie store and the Den API. Import this from
 * React Server Components and layouts, never from a file marked "use client"
 * (use ./client.tsx there). `ee/apps/den-web` does not depend on the
 * `server-only` package, so this comment is the guard.
 */
import { cache } from "react";
import { cookies } from "next/headers";
import { joinBaseUrl, readBaseUrlEnv } from "@openwork/types/url";

import { DEFAULT_DEN_LOCALE, DEN_LOCALE_COOKIE, normalizeDenLocale, type DenLocale } from "./den-locale";

/** How long the layout waits for the feature gate before deciding it is off. */
const FEATURE_GATE_TIMEOUT_MS = 2500;

/**
 * Deployment-wide state of `denLocaleSelection` (kill switch, operator lock and
 * "everyone"), read from the public Den API surface `GET /v1/features`.
 *
 * Fail closed on every problem: no upstream configured, a non-2xx answer, a
 * timeout, an unparseable body or a missing key all mean off, which means the
 * whole app renders English exactly as it did before this feature existed.
 *
 * Per-organization overrides are enforced where the choice is written: the
 * language switcher only renders when
 * `orgFeatureEnabled(orgContext, "denLocaleSelection")` is true, so an
 * organization-level off removes the entry point (and DenLocaleBootstrap then
 * clears the cookie). Turning the switch off for everyone takes effect here, on
 * the very next request, with no deploy.
 */
const denLocaleSelectionEnabledOnDeployment = cache(async (): Promise<boolean> => {
  const apiBase = readBaseUrlEnv(process.env, "DEN_API_BASE");
  if (!apiBase) {
    return false;
  }

  try {
    const response = await fetch(joinBaseUrl(apiBase, "v1/features"), {
      cache: "no-store",
      signal: AbortSignal.timeout(FEATURE_GATE_TIMEOUT_MS),
    });
    if (!response.ok) {
      return false;
    }

    const payload: unknown = await response.json();
    if (typeof payload !== "object" || payload === null) {
      return false;
    }
    const features = (payload as { features?: unknown }).features;
    if (typeof features !== "object" || features === null) {
      return false;
    }
    return (features as { denLocaleSelection?: unknown }).denLocaleSelection === true;
  } catch {
    return false;
  }
});

/** The raw cookie value, normalized without consulting the feature gate. */
export async function readDenLocalePreference(): Promise<DenLocale> {
  const store = await cookies();
  return normalizeDenLocale(store.get(DEN_LOCALE_COOKIE)?.value);
}

/**
 * The locale this request renders in. `en` unless the person picked Simplified
 * Chinese *and* the feature gate is on; the gate is never consulted for the
 * default path, so English requests make no extra network call.
 */
export async function resolveDenLocale(): Promise<DenLocale> {
  const preferred = await readDenLocalePreference();
  if (preferred === DEFAULT_DEN_LOCALE) {
    return DEFAULT_DEN_LOCALE;
  }
  return (await denLocaleSelectionEnabledOnDeployment()) ? preferred : DEFAULT_DEN_LOCALE;
}

/**
 * Whether the cookie asks for something the server is not serving (the feature
 * was turned off, or the value is not a locale at all). DenLocaleBootstrap uses
 * this to clear the stale preference so nothing downstream can honour it.
 */
export async function resolveDenLocaleMismatch(): Promise<boolean> {
  const preferred = await readDenLocalePreference();
  return preferred !== (await resolveDenLocale());
}
