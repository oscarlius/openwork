"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isSamePathname } from "../_lib/client-route";
import { getMcpOAuthSelectOrganizationRoute } from "../_lib/mcp-oauth-route";
import { useDenT } from "../../_lib/i18n/client";
import { useDenFlow } from "../_providers/den-flow-provider";
import { AuthPanel } from "./auth-panel";
import { OnboardingTexture } from "./onboarding-texture";
import { McpAppFact, McpStoryTiles, mcpStoryCopy } from "../../mcp/mcp-story";
import { useMcpClient } from "../../mcp/use-mcp-client";
import { SetupFrame } from "./setup-frame";
import { SetupFacts, SetupPanelBody } from "./setup-frame-parts";
import { TemporaryAuthNotice } from "./temporary-auth-notice";
import { MemberAuthCheckError } from "./member-auth-guard";

function SessionStatusPanel({ mode }: { mode: "checking" | "redirecting" }) {
  const t = useDenT();
  const status = mode === "checking"
    ? {
        title: t("denAuth.screen.checkingTitle"),
        body: t("denAuth.screen.checkingBody"),
      }
    : {
        title: t("denAuth.screen.openingTitle"),
        body: t("denAuth.screen.openingBody"),
      };

  return (
    <div className="grid gap-6" role="status" aria-live="polite">
      <div className="grid gap-3">
        <p className="den-eyebrow">{t("denAuth.panel.eyebrowAccount")}</p>
        <div className="rounded-[1.5rem] border border-[var(--dls-border)] bg-[var(--dls-hover)]/60 p-4">
          <div className="flex items-start gap-3">
            <span className="relative mt-1 flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full motion-safe:animate-ping rounded-full bg-[var(--dls-text-primary)] opacity-30" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--dls-text-primary)]" />
            </span>
            <div className="min-w-0">
              <p className="m-0 text-[14px] font-medium text-[var(--dls-text-primary)]">{status.title}</p>
              <p className="mt-1 text-[13px] leading-6 text-[var(--dls-text-secondary)]">{status.body}</p>
            </div>
          </div>
        </div>
      </div>
      <p className="m-0 text-xs leading-5 text-[var(--dls-text-secondary)]">
        {t("denAuth.screen.noAction")}
      </p>
    </div>
  );
}

export function AuthScreen({ agentSignIn = false }: { agentSignIn?: boolean }) {
  const t = useDenT();
  const router = useRouter();
  const pathname = usePathname();
  const routingRef = useRef(false);
  const { user, runtimeConfigLoaded, sessionHydrated, memberAuthCheckStatus, desktopAuthRequested, setupPending, authError, webAuthRequested, resolveUserLandingRoute } = useDenFlow();
  const hasResolvedSession = runtimeConfigLoaded && sessionHydrated && Boolean(user) && !authError && (!desktopAuthRequested || setupPending) && !webAuthRequested;

  useEffect(() => {
    if (!hasResolvedSession || routingRef.current) {
      return;
    }

    const oauthRoute = typeof window === "undefined" ? null : getMcpOAuthSelectOrganizationRoute(window.location.search);
    if (oauthRoute && !isSamePathname(pathname, oauthRoute)) {
      router.replace(oauthRoute);
      return;
    }

    routingRef.current = true;
    void resolveUserLandingRoute()
      .then((target) => {
        if (target && !isSamePathname(pathname, target)) {
          router.replace(target);
        }
      })
      .finally(() => {
        routingRef.current = false;
      });
  }, [hasResolvedSession, pathname, resolveUserLandingRoute, router]);

  if (agentSignIn) {
    return <AgentSignInScreen status={memberAuthCheckStatus === "error" ? "error" : !runtimeConfigLoaded || !sessionHydrated ? "checking" : hasResolvedSession ? "redirecting" : null} />;
  }

  return (
    <SetupFrame
      step="account"
      panelVisual={<OnboardingTexture />}
      // The sign-up panel carries its own heading (P2).
      title=""
      description={t("denAuth.screen.landingDescription")}
    >
      <div data-testid="auth-landing-frame">
        <div data-testid="auth-landing-form">
          {memberAuthCheckStatus === "error" ? (
            <MemberAuthCheckError />
          ) : !runtimeConfigLoaded || !sessionHydrated ? (
            <SessionStatusPanel mode="checking" />
          ) : hasResolvedSession ? (
            <SessionStatusPanel mode="redirecting" />
          ) : (
            <div className="grid gap-5">
              <TemporaryAuthNotice />
              <AuthPanel bare emailFirstFlow emailStepContent={{ title: t("denAuth.screen.emailStepTitle") }} />
            </div>
          )}
        </div>
      </div>
    </SetupFrame>
  );
}

/**
 * Sign-up while an agent waits (A7): the story names the app that asked, and
 * the panel keeps "Signing in for" above the sign-in so the person never
 * loses track of why they are here.
 */
function AgentSignInScreen({ status }: { status: "checking" | "redirecting" | "error" | null }) {
  const t = useDenT();
  const [oauthQuery, setOauthQuery] = useState("");
  useEffect(() => {
    setOauthQuery(window.location.search.replace(/^\?/, ""));
  }, []);
  const client = useMcpClient(oauthQuery);
  const story = mcpStoryCopy(client);
  return (
    <SetupFrame
      title={story.title}
      description={story.description}
      aside={<McpStoryTiles client={client} workspaceName={null} />}
      panelVisual={<OnboardingTexture />}
    >
      <div data-testid="auth-landing-frame">
        <div data-testid="auth-landing-form">
          <SetupPanelBody>
            <SetupFacts rows={[{ label: t("denAuth.screen.signingInFor"), value: <McpAppFact client={client} /> }]} />
            {status === "error" ? (
              <MemberAuthCheckError />
            ) : status ? (
              <SessionStatusPanel mode={status} />
            ) : (
              <AuthPanel
                bare
                emailFirstFlow
                socialFirst
                emailStepContent={{ title: t("denAuth.panel.createAccountTitle"), copy: t("denAuth.screen.alreadyHaveAccount") }}
              />
            )}
          </SetupPanelBody>
        </div>
      </div>
    </SetupFrame>
  );
}
