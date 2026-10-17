"use client";

import { detectPlatform, type DetectedPlatform } from "@openwork/ui/react";
import { useEffect, useState } from "react";
import { useDenT } from "../../_lib/i18n/client";
import {
  getDesktopHandoffGrant,
  getDesktopHandoffOpenworkUrl,
  rememberDesktopHandoffGrant,
} from "../_lib/desktop-handoff";
import { getErrorMessage, requestJson } from "../_lib/den-flow";
import { getInstallConfigErrorMessage } from "../_lib/install-errors";
import {
  buildBrowserInstallDownloadHref,
  detectedInstallPlatform,
  downloadCtaLabel,
  installerApiUrlFromConfig,
  installTokenFromPageUrl,
} from "../_lib/install-download";
import { createOrganizationInstallLink } from "../_lib/install-link-data";
import { isMobileUserAgent } from "../_lib/platform";
import { useDesktopHandoffStatus } from "../_lib/use-desktop-handoff-status";
import { OnboardingCard } from "./onboarding-card";
import { OnboardingShell } from "./onboarding-shell";
import { OrganizationBrandIdentity, type OrganizationBrand } from "./organization-brand-identity";

const OPENWORK_DOWNLOAD_URL = "https://openworklabs.com/download";

function ReturnToOpenWorkStatus({
  openworkUrl,
  grant,
  organizationName,
}: {
  openworkUrl: string;
  grant: string | null;
  organizationName: string;
}) {
  const t = useDenT();
  const { status, timedOut } = useDesktopHandoffStatus(grant);
  const [copied, setCopied] = useState(false);

  async function copyOpenworkUrl() {
    await navigator.clipboard.writeText(openworkUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  if (status === "consumed") {
    return (
      <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700" data-testid="desktop-connected" aria-live="polite">
        {t("denSetup.joinSuccess.connected", { organizationName })}
      </div>
    );
  }

  if (timedOut || status === "unknown") {
    return (
      <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600" data-testid="desktop-handoff-troubleshoot" aria-live="polite">
        <p className="m-0">
          {t("denSetup.joinSuccess.nothingOpened")}{" "}
          <button type="button" className="font-medium text-slate-950 underline-offset-4 hover:underline" onClick={() => window.location.assign(openworkUrl)}>
            {t("denSetup.joinSuccess.returnAgain")}
          </button>
        </p>
        <div className="grid gap-2">
          <p className="m-0">{t("denSetup.joinSuccess.stillStuck")}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input className="den-input min-w-0 flex-1 text-xs" value={openworkUrl} readOnly onFocus={(event) => event.currentTarget.select()} />
            <button type="button" className="den-button-secondary sm:w-auto" onClick={() => void copyOpenworkUrl()}>
              {copied ? t("denSetup.install.copied") : t("denSetup.joinSuccess.copyLink")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <p className="m-0 text-sm text-slate-500" aria-live="polite">
      {t("denSetup.joinSuccess.returningEllipsis")}
    </p>
  );
}

type JoinOrgSuccessProps = {
  organizationId: string;
  organizationName: string;
  brand: OrganizationBrand;
  desktopAuthRequested: boolean;
  desktopAuthScheme: string;
  onContinueInBrowser: () => void;
};

export function JoinOrgSuccess({
  organizationId,
  organizationName,
  brand,
  desktopAuthRequested,
  desktopAuthScheme,
  onContinueInBrowser,
}: JoinOrgSuccessProps) {
  const t = useDenT();
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [detected, setDetected] = useState<DetectedPlatform | null>(null);
  const [platformReady, setPlatformReady] = useState(false);
  const [installBusy, setInstallBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [handoffBusy, setHandoffBusy] = useState(false);
  const [desktopOpenworkUrl, setDesktopOpenworkUrl] = useState<string | null>(null);
  const [desktopGrant, setDesktopGrant] = useState<string | null>(null);
  const [downloadHref, setDownloadHref] = useState<string | null>(null);

  useEffect(() => {
    setIsMobile(isMobileUserAgent());
    let cancelled = false;
    void detectPlatform()
      .then((platform) => {
        if (cancelled) {
          return;
        }
        setDetected(platform ?? { os: "macos", arch: "arm64", osVersion: null, source: "ua" });
        setPlatformReady(true);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setDetected({ os: "macos", arch: "arm64", osVersion: null, source: "ua" });
        setPlatformReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function startInstallerDownload(href: string) {
    const link = document.createElement("a");
    link.href = href;
    link.rel = "noopener noreferrer";
    link.target = "_blank";
    link.setAttribute("data-testid", "join-org-download-link");
    document.body.append(link);
    link.click();
    link.remove();
  }

  async function handleGetApp() {
    setInstallBusy(true);
    setActionError(null);

    try {
      const installPageUrl = await createOrganizationInstallLink(organizationId, false);
      // Plain install links carry no token: joining made this organization
      // active, so the signed-in install routes serve its setup.
      const token = installTokenFromPageUrl(installPageUrl);

      const { response, payload } = await requestJson(
        token ? `/v1/install-config?token=${encodeURIComponent(token)}` : "/v1/me/install-config",
        { method: "GET" },
        12000,
      );
      if (!response.ok) {
        throw new Error(getInstallConfigErrorMessage(payload, response.status));
      }

      const apiUrl = installerApiUrlFromConfig(payload);
      if (!apiUrl) {
        throw new Error(t("denSetup.install.incompleteConfig"));
      }

      const platform = detectedInstallPlatform(detected) ?? "mac-arm64";
      const href = buildBrowserInstallDownloadHref(apiUrl, platform, token);
      setDownloadHref(href);
      startInstallerDownload(href);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t("denSetup.joinSuccess.downloadPrepareFailed"));
    } finally {
      setInstallBusy(false);
    }
  }

  async function handleReturnToOpenWork() {
    setHandoffBusy(true);
    setActionError(null);

    try {
      const { response, payload } = await requestJson(
        "/v1/auth/desktop-handoff",
        { method: "POST", body: JSON.stringify({ desktopScheme: desktopAuthScheme }) },
        12000,
      );
      if (!response.ok) {
        setActionError(getErrorMessage(payload, t("denSetup.joinSuccess.returnFailedStatus", { status: response.status })));
        return;
      }

      const openworkUrl = getDesktopHandoffOpenworkUrl(payload);
      if (!openworkUrl) {
        setActionError(t("denSetup.joinSuccess.noAppLink"));
        return;
      }

      const grant = getDesktopHandoffGrant(payload, openworkUrl);
      rememberDesktopHandoffGrant(grant);
      setDesktopOpenworkUrl(openworkUrl);
      setDesktopGrant(grant);
      window.location.assign(openworkUrl);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t("denSetup.joinSuccess.returnFailed"));
    } finally {
      setHandoffBusy(false);
    }
  }

  async function handleEmailDownload() {
    setEmailBusy(true);
    setActionError(null);

    try {
      const { response, payload } = await requestJson("/v1/me/send-download-link", { method: "POST" }, 12000);
      if (!response.ok) {
        setActionError(getErrorMessage(payload, t("denSetup.joinSuccess.sendLinkFailedStatus", { status: response.status })));
        return;
      }
      setEmailSent(true);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t("denSetup.joinSuccess.sendLinkFailed"));
    } finally {
      setEmailBusy(false);
    }
  }

  return (
    <OnboardingShell state="joined" width="wide" background="surface">
      <section data-testid="join-org-success">
        <OnboardingCard organization={{ name: organizationName, brand }}>
          <div className="grid gap-3">
            <h1 className="m-0 grid max-w-full gap-1 text-[30px] font-semibold leading-[38px] tracking-[-0.03em] text-slate-950 sm:text-[38px] sm:leading-[46px]">
              <span>{t("denSetup.joinSuccess.welcomeTo")}</span>
              {/* No horizontal gap: the possessive must hug the org identity
                  ("Acme Robotics's OpenWork", not "Acme Robotics 's"). */}
              <span className="flex min-w-0 flex-wrap items-center gap-y-1">
                <OrganizationBrandIdentity organizationName={organizationName} brand={brand} />
                <span className="whitespace-nowrap">{t("denSetup.joinSuccess.possessiveAppName", { appName: brand.appName })}</span>
              </span>
            </h1>
            <p className="m-0 max-w-2xl text-[15px] leading-[23px] text-slate-600">
              {desktopAuthRequested
                ? t("denSetup.joinSuccess.desktopReadyBody")
                : t("denSetup.joinSuccess.desktopAppBody")}
            </p>
          </div>

          {isMobile === null ? (
            <p className="m-0 text-sm text-slate-500">{t("denSetup.joinSuccess.preparingNext")}</p>
          ) : isMobile ? (
            <div className="grid gap-3">
              <div className="grid gap-2 rounded-2xl bg-slate-50 p-4" data-testid="join-org-mobile-note">
                <p className="m-0 text-sm font-medium text-slate-950">{t("denSetup.joinSuccess.runsOnComputer")}</p>
                <p className="m-0 text-sm leading-6 text-slate-600">
                  {t("denSetup.joinSuccess.emailLinkNote")}
                </p>
              </div>
              <button
                type="button"
                className="den-button-primary min-h-12 w-full"
                onClick={() => void handleEmailDownload()}
                disabled={emailBusy || emailSent}
                data-testid="join-org-email-download"
              >
                {emailBusy ? t("denSetup.joinSuccess.sending") : emailSent ? t("denSetup.joinSuccess.sent") : t("denSetup.joinSuccess.emailMeLink")}
              </button>
              {emailSent ? <div className="den-notice is-info">{t("denSetup.joinSuccess.sentNotice")}</div> : null}
            </div>
          ) : desktopAuthRequested ? (
            desktopOpenworkUrl ? (
              <ReturnToOpenWorkStatus openworkUrl={desktopOpenworkUrl} grant={desktopGrant} organizationName={organizationName} />
            ) : (
              <button
                type="button"
                className="den-button-primary min-h-12 w-full"
                onClick={() => void handleReturnToOpenWork()}
                disabled={handoffBusy}
                data-testid="join-org-return-openwork"
              >
                {handoffBusy ? t("denSetup.joinSuccess.returningDots") : t("denSetup.joinSuccess.returnToOpenWork")}
              </button>
            )
          ) : !platformReady ? (
            <p className="m-0 text-sm text-slate-500">{t("denSetup.joinSuccess.preparingNext")}</p>
          ) : (
            <div className="grid gap-3">
              <button
                type="button"
                className="den-button-primary min-h-12 w-full"
                onClick={() => void handleGetApp()}
                disabled={installBusy}
                data-testid="join-org-get-app"
                data-download-href={downloadHref ?? undefined}
              >
                {installBusy ? t("denSetup.joinSuccess.preparingDownload") : `${downloadCtaLabel(detected?.os ?? null)} →`}
              </button>
              <button
                type="button"
                className="min-h-12 w-full rounded-full px-3 text-sm font-medium text-slate-500 underline-offset-4 hover:text-slate-950 hover:underline"
                onClick={() => void handleReturnToOpenWork()}
                disabled={handoffBusy}
                data-testid="join-org-open-app"
              >
                {handoffBusy ? t("denSetup.joinSuccess.openingDots") : t("denSetup.joinSuccess.alreadyHaveOpenWork")}
              </button>
            </div>
          )}

          {desktopAuthRequested && desktopOpenworkUrl ? null : (
            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700" data-testid="join-org-connected">
              {t("denSetup.joinSuccess.connectedForOrg", { organizationName })}
            </div>
          )}

          <button
            type="button"
            className="min-h-12 w-full rounded-full px-3 text-sm font-medium text-slate-500 underline-offset-4 hover:text-slate-950 hover:underline"
            onClick={onContinueInBrowser}
            data-testid="join-org-continue-browser"
          >
            {t("denSetup.joinSuccess.continueInBrowser")}
          </button>

          {actionError ? (
            <div className="grid gap-3">
              <div className="den-notice is-error">{actionError}</div>
              {desktopAuthRequested ? null : (
                <a href={OPENWORK_DOWNLOAD_URL} className="den-button-secondary min-h-12 w-full">
                  {t("denSetup.joinSuccess.publicDownloadPage")}
                </a>
              )}
            </div>
          ) : null}
        </OnboardingCard>
      </section>
    </OnboardingShell>
  );
}
