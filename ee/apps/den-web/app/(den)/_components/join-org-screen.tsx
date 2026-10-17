"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useDenT } from "../../_lib/i18n/client";
import type { DenTranslate } from "../../_lib/i18n/messages";
import { getErrorMessage, requestJson } from "../_lib/den-flow";
import {
  PENDING_ORG_INVITATION_STORAGE_KEY,
  formatRoleLabel,
  getJoinOrgRoute,
  getOrgDashboardRoute,
  isEmailAllowedForOrganization,
  parseInvitationPreviewPayload,
  type DenInvitationPreview,
} from "../_lib/den-org";
import { useDenFlow } from "../_providers/den-flow-provider";
import { AuthPanel } from "./auth-panel";
import { JoinOrgSuccess } from "./join-org-success";
import { OnboardingCard } from "./onboarding-card";
import { OnboardingShell } from "./onboarding-shell";
import type { OrganizationBrand } from "./organization-brand-identity";

const primaryActionClassName = "den-button-primary min-h-12 w-full focus:outline-hidden focus:ring-4 focus:ring-slate-950/10";

type JoinedOrg = {
  id: string;
  name: string;
  slug: string;
  brand: OrganizationBrand;
};

type AccountSummary = {
  email: string;
} | null;

type AcceptedAutoResolveFailure = {
  id: string;
  reason: "membership_removed" | "unknown";
};

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</dt>
      <dd className="m-0 min-w-0 text-sm font-medium leading-6 text-slate-900 [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

function InvitationDetails({
  preview,
  account,
  roleLabel,
}: {
  preview: DenInvitationPreview;
  account: AccountSummary;
  roleLabel: string;
}) {
  const t = useDenT();
  return (
    <dl className="divide-y divide-slate-200/80 border-y border-slate-200/80" data-testid="join-org-invitation-details">
      <DetailRow label={t("denSetup.join.detailOrganization")}>{preview.organization.name}</DetailRow>
      <DetailRow label={t("denSetup.join.detailInvitedEmail")}>{preview.invitation.email}</DetailRow>
      <DetailRow label={t("denTeam.column.role")}>{roleLabel}</DetailRow>
      <DetailRow label={t("denAuth.panel.eyebrowAccount")}>{account ? account.email : t("denSetup.join.notSignedIn")}</DetailRow>
    </dl>
  );
}

function InvitationSummary({ preview }: { preview: DenInvitationPreview }) {
  const t = useDenT();
  return (
    <span data-testid="join-org-invitation-summary">
      {t("denSetup.join.summaryInvitedAs")}<span className="font-medium text-slate-950">{preview.invitation.email}</span>
    </span>
  );
}

function InvitationHeading({
  title,
  copy,
}: {
  title: string;
  copy: ReactNode;
}) {
  return (
    <div className="grid gap-2.5">
      <h1 className="m-0 text-balance text-[30px] font-semibold leading-[38px] tracking-[-0.03em] text-slate-950 sm:text-[38px] sm:leading-[46px]">{title}</h1>
      <p className="m-0 text-[15px] leading-[23px] text-slate-600">{copy}</p>
    </div>
  );
}

function ActionGroup({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3" data-testid="join-org-actions">
      {children}
    </div>
  );
}

function NotNowButton({ onClick }: { onClick: () => void }) {
  const t = useDenT();
  return (
    <button
      type="button"
      className="inline-flex min-h-12 w-full items-center justify-center rounded-full px-3 text-sm font-medium text-slate-500 transition hover:text-slate-950 focus:outline-hidden focus:ring-4 focus:ring-slate-950/10"
      onClick={onClick}
    >
      {t("denSetup.join.actionNotNow")}
    </button>
  );
}

function InlineAlert({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-medium leading-6 text-rose-700" role="alert">
      {children}
    </div>
  );
}

function getCardOrganization(preview: DenInvitationPreview | null) {
  if (!preview) {
    return null;
  }

  return {
    name: preview.organization.name,
    brand: preview.organization.branding,
  };
}

function LoadingState({
  preview = null,
  title,
  copy,
}: {
  preview?: DenInvitationPreview | null;
  title?: string;
  copy?: string;
}) {
  const t = useDenT();
  return (
    <OnboardingShell state="loading" width="wide" background="surface">
      <OnboardingCard organization={getCardOrganization(preview)}>
        <div className="grid gap-5" aria-busy="true">
          <InvitationHeading title={title ?? t("denSetup.join.loadingTitle")} copy={copy ?? t("denSetup.join.loadingBody")} />
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)]">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-slate-900" />
          </div>
        </div>
      </OnboardingCard>
    </OnboardingShell>
  );
}

function statusMessage(t: DenTranslate, preview: DenInvitationPreview | null) {
  switch (preview?.invitation.status) {
    case "accepted":
      return t("denSetup.join.statusAccepted");
    case "canceled":
      return t("denSetup.join.statusCanceled");
    case "expired":
      return t("denSetup.join.statusExpired");
    default:
      return t("denSetup.join.statusUnavailable");
  }
}

function formatAllowedDomains(t: DenTranslate, allowedEmailDomains: readonly string[] | null | undefined) {
  if (!allowedEmailDomains || allowedEmailDomains.length === 0) {
    return t("denSetup.join.anyInvitedEmail");
  }

  return allowedEmailDomains.length === 1
    ? allowedEmailDomains[0]
    : allowedEmailDomains.join(", ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getStringProperty(value: unknown, key: string) {
  if (!isRecord(value)) {
    return null;
  }

  const property = value[key];
  return typeof property === "string" ? property : null;
}

function getJoinedOrgFromPayload(payload: unknown, preview: DenInvitationPreview): JoinedOrg {
  const organizationSlug = getStringProperty(payload, "organizationSlug")?.trim() || preview.organization.slug;
  const organizationId = getStringProperty(payload, "organizationId")?.trim() || preview.organization.id;

  return {
    id: organizationId,
    name: preview.organization.name,
    slug: organizationSlug,
    brand: preview.organization.branding,
  };
}

function InviteAuthPanel({
  preview,
  initialMode,
}: {
  preview: DenInvitationPreview;
  initialMode: "sign-in" | "sign-up";
}) {
  const t = useDenT();
  return (
    <div data-testid="join-org-auth">
      <AuthPanel
        bare
        hideIntro
        prefilledEmail={preview.invitation.email}
        prefillKey={preview.invitation.id}
        initialMode={initialMode}
        lockEmail
        hideEmailField
        hideLockedEmailSummary
        hideSocialAuth
        emailFirstFlow
        emailFirstInvitationId={preview.invitation.id}
        resolveEmailFirstOnPrefill
        signUpContent={{
          submitLabel: t("denSetup.join.submitCreateAccount"),
        }}
        signInContent={{
          title: t("denSetup.join.signInTitle"),
          copy: initialMode === "sign-in"
            ? t("denSetup.join.signInAsBody", { email: preview.invitation.email })
            : t("denSetup.join.useInvitedAccountBody"),
          submitLabel: initialMode === "sign-in" ? t("denSetup.join.signInOpenWorkspaceAction") : t("denSetup.join.signInJoinAction"),
        }}
        verificationContent={{
          title: t("denSetup.join.verifyTitle"),
          copy: t("denSetup.join.verifyBody", { email: preview.invitation.email }),
          submitLabel: t("denSetup.join.verifyJoinAction"),
        }}
      />
    </div>
  );
}

export function JoinOrgScreen({ invitationId }: { invitationId: string }) {
  const t = useDenT();
  const router = useRouter();
  const { user, sessionHydrated, signOut, revalidateSession, desktopAuthRequested, desktopAuthScheme } = useDenFlow();
  const [preview, setPreview] = useState<DenInvitationPreview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [joinedOrg, setJoinedOrg] = useState<JoinedOrg | null>(null);
  const [acceptedAutoResolveFailure, setAcceptedAutoResolveFailure] = useState<AcceptedAutoResolveFailure | null>(null);
  const acceptedInvitationResolutionRef = useRef<string | null>(null);

  const invitedEmailMatches = preview && user
    ? preview.invitation.email.trim().toLowerCase() === user.email.trim().toLowerCase()
    : false;
  const invitedEmailAllowed = preview
    ? isEmailAllowedForOrganization(preview.organization.allowedEmailDomains, preview.invitation.email)
    : true;
  const signedInEmailAllowed = preview && user
    ? isEmailAllowedForOrganization(preview.organization.allowedEmailDomains, user.email)
    : true;
  const roleLabel = preview ? formatRoleLabel(preview.invitation.role) : "";
  const allowedDomainsLabel = preview ? formatAllowedDomains(t, preview.organization.allowedEmailDomains) : "";

  const clearPendingInvitation = useCallback(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(PENDING_ORG_INVITATION_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      if (!invitationId) {
        setPreview(null);
        setPreviewError(t("denSetup.join.missingLink"));
        setPreviewBusy(false);
        return;
      }

      setPreviewBusy(true);
      setPreviewError(null);

      try {
        const { response, payload } = await requestJson(
          `/v1/orgs/invitations/preview?id=${encodeURIComponent(invitationId)}`,
          { method: "GET" },
          12000,
        );

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          if (typeof window !== "undefined" && response.status === 404) {
            window.sessionStorage.removeItem(PENDING_ORG_INVITATION_STORAGE_KEY);
          }

          setPreview(null);
          setPreviewError(getErrorMessage(payload, response.status === 404 ? t("denSetup.join.statusUnavailable") : t("denSetup.join.loadFailedStatus", { status: response.status })));
          return;
        }

        const nextPreview = parseInvitationPreviewPayload(payload);
        if (!nextPreview) {
          setPreview(null);
          setPreviewError(t("denSetup.join.detailsIncomplete"));
          return;
        }

        setPreview(nextPreview);
      } catch (error) {
        if (!cancelled) {
          setPreview(null);
          setPreviewError(error instanceof Error ? error.message : t("denSetup.join.loadFailed"));
        }
      } finally {
        if (!cancelled) {
          setPreviewBusy(false);
        }
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [invitationId, t]);

  useEffect(() => {
    if (
      !invitationId ||
      !sessionHydrated ||
      !preview ||
      preview.invitation.status !== "accepted" ||
      !user ||
      !invitedEmailMatches
    ) {
      return;
    }

    const acceptedPreview = preview;
    const acceptedInvitationId = acceptedPreview.invitation.id;

    if (acceptedInvitationResolutionRef.current === acceptedInvitationId) {
      return;
    }

    acceptedInvitationResolutionRef.current = acceptedInvitationId;

    // The ref above guarantees a single in-flight resolution per invitation,
    // so every outcome below is applied unconditionally. Sign-in rehydration
    // churns the user identity mid-flight; a cancellation guard here dropped
    // the outcome and stranded users on the loading card in two real eval
    // regressions (first the success redirect, then the 410 failure card).
    async function resolveAcceptedInvitation() {
      setAcceptedAutoResolveFailure(null);

      try {
        const { response, payload } = await requestJson(
          "/v1/orgs/invitations/accept",
          {
            method: "POST",
            body: JSON.stringify({ id: invitationId }),
          },
          12000,
        );

        if (!response.ok) {
          setAcceptedAutoResolveFailure({
            id: acceptedInvitationId,
            reason: getStringProperty(payload, "error") === "membership_removed" ? "membership_removed" : "unknown",
          });
          return;
        }

        clearPendingInvitation();
        const nextJoinedOrg = getJoinedOrgFromPayload(payload, acceptedPreview);

        if (desktopAuthRequested) {
          setJoinedOrg(nextJoinedOrg);
          return;
        }

        router.replace("/install");
      } catch {
        // Transient transport failure: allow a later effect run to retry.
        acceptedInvitationResolutionRef.current = null;
        setAcceptedAutoResolveFailure({ id: acceptedInvitationId, reason: "unknown" });
      }
    }

    void resolveAcceptedInvitation();
  }, [clearPendingInvitation, desktopAuthRequested, invitationId, invitedEmailMatches, preview, router, sessionHydrated, user]);

  function handleNotNow() {
    clearPendingInvitation();
    router.replace("/");
  }

  async function handleAcceptInvitation() {
    if (!invitationId) {
      setJoinError(t("denSetup.join.missingLink"));
      return;
    }
    if (!preview) {
      setJoinError(t("denSetup.join.detailsStillLoading"));
      return;
    }

    setJoinBusy(true);
    setJoinError(null);

    try {
      const { response, payload } = await requestJson(
        "/v1/orgs/invitations/accept",
        {
          method: "POST",
          body: JSON.stringify({ id: invitationId }),
        },
        12000,
      );

      if (response.status === 401) {
        // No live session: it expired, was revoked, or was never created.
        // Ask Den; a dead session drops the page back to the invite sign-in
        // form instead of showing the raw "unauthorized" code (ENG-550).
        if (!(await revalidateSession())) {
          setSessionEnded(true);
          return;
        }
        setJoinError(t("denSetup.join.joinRetryFailed"));
        return;
      }

      if (!response.ok) {
        setJoinError(getErrorMessage(payload, response.status === 404 ? t("denSetup.join.acceptFailed") : t("denSetup.join.joinFailedStatus", { status: response.status })));
        return;
      }

      clearPendingInvitation();
      const nextJoinedOrg = getJoinedOrgFromPayload(payload, preview);
      if (desktopAuthRequested) {
        setJoinedOrg(nextJoinedOrg);
      } else {
        router.replace("/install");
      }
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : t("denSetup.join.joinFailed"));
    } finally {
      setJoinBusy(false);
    }
  }

  async function handleSwitchAccount() {
    await signOut();
    if (typeof window !== "undefined" && invitationId) {
      window.sessionStorage.setItem(PENDING_ORG_INVITATION_STORAGE_KEY, invitationId);
    }
    router.replace(getJoinOrgRoute(invitationId));
  }

  if (!sessionHydrated || previewBusy) {
    return <LoadingState />;
  }

  if (joinedOrg) {
    return (
      <JoinOrgSuccess
        organizationId={joinedOrg.id}
        organizationName={joinedOrg.name}
        brand={joinedOrg.brand}
        desktopAuthRequested={desktopAuthRequested}
        desktopAuthScheme={desktopAuthScheme}
        onContinueInBrowser={() => router.replace(joinedOrg.slug ? getOrgDashboardRoute(joinedOrg.slug) : "/dashboard")}
      />
    );
  }

  if (!preview) {
    return (
      <OnboardingShell state="invalid" width="wide" background="surface">
        <OnboardingCard organization={getCardOrganization(preview)}>
          <InvitationHeading title={t("denSetup.join.cannotOpenTitle")} copy={previewError ?? t("denSetup.join.cannotLoadBody")} />
          <ActionGroup>
            <button type="button" className={primaryActionClassName} onClick={handleNotNow}>
              {t("denSetup.join.backToCloud")}
            </button>
          </ActionGroup>
        </OnboardingCard>
      </OnboardingShell>
    );
  }

  const account = user ? { email: user.email } : null;
  const showAcceptAction = preview.invitation.status === "pending" && Boolean(user) && invitedEmailMatches;
  const acceptedAutoResolveFailureForPreview = acceptedAutoResolveFailure?.id === preview.invitation.id
    ? acceptedAutoResolveFailure
    : null;
  const acceptedAutoResolveFailed = Boolean(acceptedAutoResolveFailureForPreview);

  if (preview.invitation.status === "accepted" && user && invitedEmailMatches && !acceptedAutoResolveFailed) {
    return (
      <LoadingState
        preview={preview}
        title={t("denSetup.join.openingTitle")}
        copy={t("denSetup.join.confirmMembershipBody", { organizationName: preview.organization.name })}
      />
    );
  }

  if (preview.invitation.status === "accepted" && user && invitedEmailMatches && acceptedAutoResolveFailureForPreview?.reason === "membership_removed") {
    return (
      <OnboardingShell state="membership-removed" width="wide" background="surface">
        <OnboardingCard organization={getCardOrganization(preview)}>
          <InvitationHeading
            title={t("denSetup.join.accessRemovedTitle")}
            copy={t("denSetup.join.accessRemovedBody", { organizationName: preview.organization.name })}
          />
          <ActionGroup>
            <button type="button" className={primaryActionClassName} onClick={handleNotNow}>
              {t("denSetup.join.backToCloud")}
            </button>
          </ActionGroup>
        </OnboardingCard>
      </OnboardingShell>
    );
  }

  if (preview.invitation.status === "accepted" && !user) {
    return (
      <OnboardingShell state="accepted-signed-out" width="wide" background="surface">
        <OnboardingCard organization={getCardOrganization(preview)}>
          <div className="grid gap-4">
            <InvitationHeading
              title={t("denSetup.join.alreadyJoinedTitle", { organizationName: preview.organization.name })}
              copy={t("denSetup.join.alreadyJoinedBody", { email: preview.invitation.email })}
            />
            <InvitationDetails preview={preview} account={account} roleLabel={roleLabel} />
          </div>

          <InviteAuthPanel preview={preview} initialMode="sign-in" />

          <ActionGroup>
            <NotNowButton onClick={handleNotNow} />
          </ActionGroup>
        </OnboardingCard>
      </OnboardingShell>
    );
  }

  if (preview.invitation.status === "accepted" && user && !invitedEmailMatches) {
    return (
      <OnboardingShell state="accepted-wrong-account" width="wide" background="surface">
        <OnboardingCard organization={getCardOrganization(preview)}>
          <InvitationHeading
            title={t("denSetup.join.useInvitedAccountTitle")}
            copy={t("denSetup.join.wrongAccountBody", { email: preview.invitation.email, signedInEmail: user.email })}
          />
          <InvitationDetails preview={preview} account={account} roleLabel={roleLabel} />
          <ActionGroup>
            <button
              type="button"
              className={primaryActionClassName}
              onClick={() => void handleSwitchAccount()}
              disabled={joinBusy}
            >
              {t("denSetup.join.useDifferentAccount")}
            </button>
            <NotNowButton onClick={handleNotNow} />
          </ActionGroup>
        </OnboardingCard>
      </OnboardingShell>
    );
  }

  if (preview.invitation.status !== "pending") {
    return (
      <OnboardingShell state="unavailable" width="wide" background="surface">
        <OnboardingCard organization={getCardOrganization(preview)}>
          <InvitationHeading title={t("denSetup.join.cannotUseTitle")} copy={statusMessage(t, preview)} />
          <InvitationDetails preview={preview} account={account} roleLabel={roleLabel} />
          <ActionGroup>
            <button type="button" className={primaryActionClassName} onClick={handleNotNow}>
              {t("denSetup.join.backToCloud")}
            </button>
          </ActionGroup>
        </OnboardingCard>
      </OnboardingShell>
    );
  }

  if (!invitedEmailAllowed) {
    return (
      <OnboardingShell state="domain-blocked" width="wide" background="surface">
        <OnboardingCard organization={getCardOrganization(preview)}>
          <InvitationHeading
            title={t("denSetup.join.domainBlockedTitle")}
            copy={t("denSetup.join.domainBlockedBody", { organizationName: preview.organization.name, domains: allowedDomainsLabel })}
          />
          <InvitationDetails preview={preview} account={account} roleLabel={roleLabel} />
          <ActionGroup>
            <button type="button" className={primaryActionClassName} onClick={handleNotNow}>
              {t("denSetup.join.backToCloud")}
            </button>
          </ActionGroup>
        </OnboardingCard>
      </OnboardingShell>
    );
  }

  if (!user) {
    return (
      <OnboardingShell state="signed-out" width="wide" background="surface">
        <OnboardingCard organization={getCardOrganization(preview)}>
          <div className="grid gap-4">
            <InvitationHeading
              title={t("denSetup.join.joinOrgTitle", { organizationName: preview.organization.name })}
              copy={<InvitationSummary preview={preview} />}
            />
            {preview.organization.allowedEmailDomains?.length ? (
              <p className="m-0 text-[15px] leading-[23px] text-slate-600">
                {t("denSetup.join.workspaceAcceptsOnly", { allowedDomains: allowedDomainsLabel })}
              </p>
            ) : null}
          </div>

          {sessionEnded ? <InlineAlert>{t("denSetup.join.sessionEnded")}</InlineAlert> : null}

          <InviteAuthPanel preview={preview} initialMode="sign-up" />

          <ActionGroup>
            <NotNowButton onClick={handleNotNow} />
          </ActionGroup>
        </OnboardingCard>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell state="signed-in" width="wide" background="surface">
      <OnboardingCard organization={getCardOrganization(preview)}>
        <InvitationHeading title={t("denSetup.join.joinOrgTitleWithPeriod", { organizationName: preview.organization.name })} copy={t("denSetup.join.reviewBody")} />
        <InvitationDetails preview={preview} account={account} roleLabel={roleLabel} />

        {user && !signedInEmailAllowed ? (
          <div className="grid gap-4">
            <p className="m-0 text-[15px] leading-[23px] text-slate-600">
              {t("denSetup.join.domainMismatchOnlyAccepts", { organizationName: preview.organization.name })}<span className="font-medium text-slate-950">{allowedDomainsLabel}</span>{t("denSetup.join.domainMismatchSignedInAs")}<span className="font-medium text-slate-950">{user.email}</span>{t("denSetup.join.domainMismatchCannotJoin")}
            </p>
            <p className="m-0 text-[15px] leading-[23px] text-slate-500">
              {t("denSetup.join.logOutHelp")}
            </p>
            <ActionGroup>
              <button
                type="button"
                className={primaryActionClassName}
                onClick={() => void handleSwitchAccount()}
                disabled={joinBusy}
              >
                {t("denSetup.join.logOut")}
              </button>
              <NotNowButton onClick={handleNotNow} />
            </ActionGroup>
          </div>
        ) : !invitedEmailMatches ? (
          <div className="grid gap-4">
            <p className="m-0 text-[15px] leading-[23px] text-slate-600">
              {t("denSetup.join.inviteIsFor")}<span className="font-medium text-slate-950">{preview.invitation.email}</span>{t("denSetup.join.switchToContinue")}
            </p>
            <ActionGroup>
              <button
                type="button"
                className={primaryActionClassName}
                onClick={() => void handleSwitchAccount()}
                disabled={joinBusy}
              >
                {t("denSetup.join.useDifferentAccount")}
              </button>
              <NotNowButton onClick={handleNotNow} />
            </ActionGroup>
          </div>
        ) : (
          <div className="grid gap-4">
            <p className="m-0 text-[15px] leading-[23px] text-slate-600">{t("denSetup.join.oneClickAway")}</p>
            <ActionGroup>
              <button
                type="button"
                className={primaryActionClassName}
                onClick={() => void handleAcceptInvitation()}
                disabled={!showAcceptAction || joinBusy}
              >
                {joinBusy ? t("denSetup.join.joining") : t("denSetup.join.joinOrgTitle", { organizationName: preview.organization.name })}
              </button>
              <NotNowButton onClick={handleNotNow} />
            </ActionGroup>
          </div>
        )}

        {joinError ? <InlineAlert>{joinError}</InlineAlert> : null}
        {previewError ? <InlineAlert>{previewError}</InlineAlert> : null}
      </OnboardingCard>
    </OnboardingShell>
  );
}
