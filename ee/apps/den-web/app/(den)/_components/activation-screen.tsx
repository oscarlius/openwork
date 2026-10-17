"use client";

import { CheckCircle2, Copy, ExternalLink, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getErrorMessage, requestJson } from "../_lib/den-flow";
import { useDenT } from "../../_lib/i18n/client";
import { OnboardingShell } from "./onboarding-shell";
import { OrganizationBrandIdentity, type OrganizationBrand } from "./organization-brand-identity";

const CONNECT_CODE_PATTERN = /^[A-Za-z0-9_-]{24,128}$/;
const RETURN_TO_OPENWORK_URL = "openwork://open";

type ActivationDetails = {
  status: "pending" | "connected";
  organizationName: string;
  brand: OrganizationBrand;
  apiBaseUrl: string;
  expiresAt: string;
};

type ActivationState =
  | { kind: "loading" }
  | { kind: "ready"; details: ActivationDetails }
  | { kind: "expired" }
  | { kind: "error"; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseActivationDetails(value: unknown): ActivationDetails | null {
  if (!isRecord(value) || (value.status !== "pending" && value.status !== "connected")) return null;
  if (!isRecord(value.claims) || !isRecord(value.claims.org) || !isRecord(value.claims.brand) || !isRecord(value.claims.den)) {
    return null;
  }

  const organizationName = value.claims.org.name;
  const appName = value.claims.brand.appName;
  const logoUrl = value.claims.brand.logoUrl;
  const iconUrl = value.claims.brand.iconUrl;
  const apiBaseUrl = value.claims.den.apiBaseUrl;
  const expiresAt = value.expiresAt;
  if (
    typeof organizationName !== "string"
    || typeof appName !== "string"
    || (logoUrl !== null && typeof logoUrl !== "string")
    || (iconUrl !== null && typeof iconUrl !== "string")
    || typeof apiBaseUrl !== "string"
    || typeof expiresAt !== "string"
  ) {
    return null;
  }

  try {
    new URL(apiBaseUrl);
    if (logoUrl) new URL(logoUrl);
    if (iconUrl) new URL(iconUrl);
    if (Number.isNaN(Date.parse(expiresAt))) return null;
  } catch {
    return null;
  }

  return {
    status: value.status,
    organizationName,
    brand: { appName, logoUrl, iconUrl },
    apiBaseUrl,
    expiresAt,
  };
}

function connectUrlFor(code: string, apiBaseUrl: string) {
  const url = new URL("openwork://connect");
  url.searchParams.set("code", code);
  url.searchParams.set("apiBaseUrl", apiBaseUrl);
  return url.toString();
}

export function ActivationScreen() {
  const t = useDenT();
  const searchParams = useSearchParams();
  const code = searchParams.get("code")?.trim() ?? "";
  const [state, setState] = useState<ActivationState>({ kind: "loading" });
  const [openAttempted, setOpenAttempted] = useState(false);
  const [copied, setCopied] = useState<"connect" | "return" | null>(null);

  useEffect(() => {
    if (!CONNECT_CODE_PATTERN.test(code)) {
      setState({ kind: "error", message: t("denAuth.activation.incompleteLink") });
      return;
    }

    let cancelled = false;
    let timer: number | null = null;

    async function poll() {
      try {
        const { response, payload } = await requestJson(
          "/v1/install-connect/status",
          { method: "POST", body: JSON.stringify({ code }) },
          12000,
        );
        if (cancelled) return;
        if (response.status === 410) {
          setState({ kind: "expired" });
          return;
        }
        if (!response.ok) {
          setState({
            kind: "error",
            message: getErrorMessage(payload, t("denAuth.activation.couldNotOpen")),
          });
          return;
        }

        const details = parseActivationDetails(payload);
        if (!details) {
          setState({ kind: "error", message: t("denAuth.activation.incompleteDetails") });
          return;
        }
        setState({ kind: "ready", details });
        if (details.status === "pending") {
          timer = window.setTimeout(() => void poll(), 2000);
        }
      } catch {
        if (!cancelled) {
          timer = window.setTimeout(() => void poll(), 4000);
        }
      }
    }

    void poll();
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [code]);

  async function copyLink(kind: "connect" | "return", value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1800);
  }

  if (state.kind === "loading") {
    return (
      <OnboardingShell state="activation-loading" width="wide">
        <section className="grid justify-items-center gap-4 rounded-[1.75rem] border border-slate-200/80 bg-white p-8 text-center" data-testid="activation-page">
          <LoaderCircle className="size-6 animate-spin text-slate-500" aria-hidden="true" />
          <h1 className="den-title-lg">{t("denAuth.activation.preparingTitle")}</h1>
          <p className="den-copy">{t("denAuth.activation.preparingBody")}</p>
        </section>
      </OnboardingShell>
    );
  }

  if (state.kind === "expired" || state.kind === "error") {
    const message = state.kind === "expired"
      ? t("denAuth.activation.expiredBody")
      : state.message;
    return (
      <OnboardingShell state="activation-error" width="wide">
        <section className="grid gap-5 rounded-[1.75rem] border border-slate-200/80 bg-white p-6 sm:p-8" data-testid="activation-page">
          <p className="den-eyebrow">{t("denAuth.activation.eyebrow", { app: "OpenWork" })}</p>
          <h1 className="den-title-lg">{t("denAuth.activation.needsApprovalTitle")}</h1>
          <p className="den-copy" role="alert">{message}</p>
          <button type="button" className="den-button-secondary w-fit" onClick={() => window.history.back()}>
            {t("denAuth.activation.returnToInstall")}
          </button>
        </section>
      </OnboardingShell>
    );
  }

  const { details } = state;
  const connectUrl = connectUrlFor(code, details.apiBaseUrl);
  const connected = details.status === "connected";

  return (
    <OnboardingShell state={connected ? "activation-connected" : "activation-pending"} width="wide">
      <section
        className="grid gap-6 rounded-[1.75rem] border border-slate-200/80 bg-white p-6 sm:p-8 md:p-10"
        data-testid="activation-page"
      >
        <div className="grid justify-items-start gap-3">
          <p className="den-eyebrow">{t("denAuth.activation.eyebrow", { app: details.brand.appName })}</p>
          <h1 className="m-0 text-[2rem] font-semibold leading-[1.04] tracking-[-0.05em] text-slate-950 sm:text-[2.5rem]">
            {connected ? t("denAuth.activation.connectedLead") : t("denAuth.activation.connectLead")}
            <OrganizationBrandIdentity organizationName={details.organizationName} brand={details.brand} />
          </h1>
          <p className="den-copy">
            {connected
              ? t("denAuth.activation.connectedBody", { org: details.organizationName, app: details.brand.appName })
              : t("denAuth.activation.pendingBody", { org: details.organizationName })}
          </p>
        </div>

        {connected ? (
          <div className="grid gap-4" aria-live="polite">
            <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800" data-testid="activation-connected">
              <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
              {t("denAuth.activation.connectedBadge", { org: details.organizationName })}
            </div>
            <a className="den-button-primary w-full justify-center sm:w-fit" href={RETURN_TO_OPENWORK_URL} data-testid="activation-return-openwork">
              {t("denAuth.activation.returnToOpenwork")}
              <ExternalLink className="size-4" aria-hidden="true" />
            </a>
            <div className="grid gap-2 rounded-2xl bg-slate-50 p-4">
              <p className="m-0 text-sm text-slate-600">{t("denAuth.activation.nothingOpenedHint")}</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input className="den-input min-w-0 flex-1 text-xs" value={RETURN_TO_OPENWORK_URL} readOnly onFocus={(event) => event.currentTarget.select()} />
                <button type="button" className="den-button-secondary sm:w-auto" onClick={() => void copyLink("return", RETURN_TO_OPENWORK_URL)}>
                  <Copy className="size-4" aria-hidden="true" />
                  {copied === "return" ? t("denAuth.activation.copied") : t("denAuth.activation.copyLink")}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4" aria-live="polite">
            <button
              type="button"
              className="den-button-primary w-full justify-center sm:w-fit"
              data-testid="activation-open-openwork"
              onClick={() => {
                setOpenAttempted(true);
                window.location.assign(connectUrl);
              }}
            >
              {t("denAuth.activation.openOpenwork")}
              <ExternalLink className="size-4" aria-hidden="true" />
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              {openAttempted ? t("denAuth.activation.waitingAccept") : t("denAuth.activation.waitingApproval")}
            </div>
            {openAttempted ? (
              <div className="grid gap-2 rounded-2xl bg-slate-50 p-4" data-testid="activation-open-fallback">
                <p className="m-0 text-sm text-slate-600">{t("denAuth.activation.didNotAppearHint")}</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input className="den-input min-w-0 flex-1 text-xs" value={connectUrl} readOnly onFocus={(event) => event.currentTarget.select()} />
                  <button type="button" className="den-button-secondary sm:w-auto" onClick={() => void copyLink("connect", connectUrl)}>
                    <Copy className="size-4" aria-hidden="true" />
                    {copied === "connect" ? t("denAuth.activation.copied") : t("denAuth.activation.copyOpenworkLink")}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </OnboardingShell>
  );
}
