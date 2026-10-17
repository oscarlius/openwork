"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, KeyRound, ArrowUpRight, ArrowRight } from "lucide-react";
import { DenBadge } from "../../_components/ui/badge";
import { DesktopHandoffAction } from "../../_components/auth-panel";
import { SetupFrame } from "../../_components/setup-frame";
import { getCustomLlmProvidersRoute, getInferenceRoute, getOrgDashboardRoute } from "../../_lib/den-org";
import { getErrorMessage, normalizeAuthIntentParam, PENDING_AUTH_INTENT_STORAGE_KEY, requestJson } from "../../_lib/den-flow";
import { getDesktopGrant } from "../../_lib/desktop-handoff";
import { useDenT } from "../../../_lib/i18n/client";
import { useDenFlow } from "../../_providers/den-flow-provider";
import { useOrgDashboard } from "../_providers/org-dashboard-provider";

export function MarketplaceOnboardingScreen() {
  const t = useDenT();
  const router = useRouter();
  const { orgId, orgSlug, activeOrg } = useOrgDashboard();
  const { desktopAuthRequested, desktopRedirectUrl, authError, completeSetup } = useDenFlow();
  const [completing, setCompleting] = useState(false);
  const modelsHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (desktopAuthRequested && normalizeAuthIntentParam(window.sessionStorage.getItem(PENDING_AUTH_INTENT_STORAGE_KEY)) === "models") {
      modelsHeading.current?.focus();
    }
  }, [desktopAuthRequested]);
  const { data: modelsEnabled, isPending: modelsLoading, error: modelsError } = useQuery({
    queryKey: ["onboarding", "inference", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      if (!orgId) throw new Error("Choose a workspace to check OpenWork Models.");
      const { response, payload } = await requestJson("/v1/inference", { method: "GET", headers: { "x-openwork-org-id": orgId } }, 12000);
      if (!response.ok) throw new Error(getErrorMessage(payload, "Could not check OpenWork Models."));
      return typeof payload === "object" && payload !== null && "inference" in payload
        && typeof payload.inference === "object" && payload.inference !== null
        && "enabled" in payload.inference && payload.inference.enabled === true;
    },
    staleTime: 0,
  });

  async function finish() {
    if (!orgId || completing) return;
    setCompleting(true);
    try {
      if (await completeSetup(orgId) && !desktopAuthRequested) router.push(getOrgDashboardRoute(orgSlug));
    } finally {
      setCompleting(false);
    }
  }

  return (
    <SetupFrame step="ready" title={t("denOnboarding.models.title")} description={t("denOnboarding.models.description")}>
      <div className="grid gap-6" data-testid="marketplace-onboarding">
        <section aria-labelledby="setup-models-heading" className="grid gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">{t("denOnboarding.models.eyebrow")}</p>
            <h2 id="setup-models-heading" ref={modelsHeading} tabIndex={-1} className="mt-2 text-xl font-semibold tracking-[-0.03em]">{t("denOnboarding.models.choiceTitle")}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--dls-text-secondary)]" role="status">
              {modelsLoading ? t("denOnboarding.models.checking") : modelsError ? t("denOnboarding.models.unavailable") : modelsEnabled ? t("denOnboarding.models.onForWorkspace") : t("denOnboarding.models.signingInNote")}
            </p>
            {modelsEnabled ? <DenBadge icon={Check}>{t("denOnboarding.models.badgeOn")}</DenBadge> : null}
          </div>
          <div className="divide-y divide-[var(--dls-border)] overflow-hidden rounded-2xl border border-[var(--dls-border)]">
            <div className="flex items-start gap-3 p-4 sm:p-5" data-testid="onboarding-choice-openwork-models">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--dls-hover)]">
                <img src="/openwork-mark.svg" alt="" aria-hidden className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold">{t("denOnboarding.models.openworkTitle")}</h3>
                <p className="mt-1 text-[13px] leading-5 text-[var(--dls-text-secondary)]">{t("denOnboarding.models.managedBody")}</p>
                <Link href={getInferenceRoute(orgSlug)} className="mt-3 inline-flex items-center gap-1.5 rounded-sm text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-neutral-950">
                  {modelsEnabled ? t("denOnboarding.models.manage") : t("denOnboarding.models.explore")}<ArrowUpRight className="size-3.5" aria-hidden />
                </Link>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 sm:p-5" data-testid="onboarding-choice-byok">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--dls-hover)]"><KeyRound className="size-[18px] text-[var(--dls-text-secondary)]" aria-hidden /></div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold">{t("denOnboarding.models.byokTitle")}</h3>
                <p className="mt-1 text-[13px] leading-5 text-[var(--dls-text-secondary)]">{t("denOnboarding.models.byokBody")}</p>
                <Link href={getCustomLlmProvidersRoute(orgSlug)} className="mt-3 inline-flex items-center gap-1.5 rounded-sm text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-neutral-950">
                  {t("denOnboarding.models.addProvider")}<ArrowUpRight className="size-3.5" aria-hidden />
                </Link>
              </div>
            </div>
          </div>
        </section>
        <section aria-labelledby="setup-finish-heading" className="grid gap-4 border-t border-[var(--dls-border)] pt-6" data-testid="onboarding-finish">
          <div>
            <h2 id="setup-finish-heading" className="text-base font-semibold tracking-tight">{t("denOnboarding.finish.readyTitle")}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--dls-text-secondary)]">{t("denOnboarding.finish.body")}</p>
          </div>
          {authError ? <p role="alert" className="text-sm text-rose-600">{authError}</p> : null}
          {desktopRedirectUrl ? <DesktopHandoffAction openworkUrl={desktopRedirectUrl} grant={getDesktopGrant(desktopRedirectUrl)} organizationName={activeOrg?.name ?? null} showCopyLinkByDefault /> : (
            <button type="button" onClick={() => void finish()} disabled={!orgId || completing} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2">
              {completing ? t("denOnboarding.finish.completing") : desktopAuthRequested ? t("denOnboarding.finish.completeAndOpen") : t("denOnboarding.finish.completeSetup")}<ArrowRight className="size-4" aria-hidden />
            </button>
          )}
        </section>
      </div>
    </SetupFrame>
  );
}
