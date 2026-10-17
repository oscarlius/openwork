"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { DenButton } from "../../_components/ui/button";
import { getAddConnectorRoute, getMcpConnectionRoute, getMcpConnectionsRoute, getOrgAccessFlags } from "../../_lib/den-org";
import { useDenT } from "../../../_lib/i18n/client";
import { useOrgDashboard } from "../_providers/org-dashboard-provider";
import { type AccessDraft, accessPeopleIds, peopleLabel } from "./access-summary";
import { useConnectorSetup } from "./connector-setup";
import { ApiKeyFields, ApiKeySchemeAdvanced, OAuthAppFields } from "./connector-setup-fields";
import { useConnectorTarget } from "./connector-setup-screen";
import { useDenToast } from "./den-toast";
import { ItemHeader, ItemPage, SectionTitle, StepFooter } from "./item-header";
import { ConfirmDialog } from "./item-list";
import { ConnectorLogo } from "./item-logo";
import { useSaveConnectionAccess } from "./item-sharing";
import { DEFAULT_API_KEY_AUTH_SCHEME, type ExternalMcpApiKeyAuthScheme, type ExternalMcpCredentialMode, useUpdateMcpConnection, useCheckMcpConnection } from "./mcp-connections-data";
import { usesMemberApiKey } from "./member-api-key";
import { SetupChecks } from "./setup-checks";
import { WhoCanUseIt } from "./who-can-use-it";

function SignInChoice({ name, value, onChange, disabled, kind = "oauth", sharedDescription }: {
  name: string;
  value: ExternalMcpCredentialMode;
  onChange: (value: ExternalMcpCredentialMode) => void;
  disabled: boolean;
  kind?: "oauth" | "api_key";
  sharedDescription?: string;
}) {
  const t = useDenT();
  const options: { value: ExternalMcpCredentialMode; title: string; description: string }[] = [
    kind === "api_key"
      ? { value: "per_member", title: t("denConnector.setup.eachPersonAddsKey"), description: t("denConnector.setup.oneConnectionOwnKey", { name }) }
      : { value: "per_member", title: t("denConnector.list.eachPersonSignsIn"), description: t("denConnector.setup.ownAccount", { name }) },
    kind === "api_key"
      ? { value: "shared", title: t("denConnector.setup.oneKeyForEveryone"), description: sharedDescription ?? t("denConnector.setup.oneApiKeyForAll", { name }) }
      : { value: "shared", title: t("denConnector.list.oneAccountForAll"), description: sharedDescription ?? t("denConnector.setup.oneAccountYouSignIn", { name }) },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t("denConnector.setup.howPeopleConnect")}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <label
            key={option.value}
            className={`flex cursor-pointer items-start gap-3 rounded-2xl border bg-white px-4 py-3.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gray-200 ${selected ? "border-gray-400" : "border-gray-100 hover:border-gray-200"}`}
          >
            <input
              type="radio"
              name="sign-in-mode"
              value={option.value}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(option.value)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-gray-900"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-[14px] font-medium leading-5 text-gray-900">{option.title}</span>
              <span className="text-[13px] leading-[18px] text-gray-500">{option.description}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** C3 and C4: the checks fill in, then the admin picks how people sign in and who gets it. */
export function AdminConnectorSetupScreen({ catalogId }: { catalogId: string }) {
  const t = useDenT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useDenToast();
  const { orgSlug, orgContext } = useOrgDashboard();
  const canShareWithEveryone = orgContext
    ? getOrgAccessFlags(orgContext.currentMember.role, orgContext.currentMember.isOwner, orgContext.currentMember.permissions).canShareWithEveryone
    : false;
  const { target, loading, missing, failed } = useConnectorTarget(catalogId);
  const updateConnection = useUpdateMcpConnection();
  const checkConnection = useCheckMcpConnection();
  const saveAccess = useSaveConnectionAccess();
  const viewerId = orgContext?.currentMember.id ?? null;
  const [mode, setMode] = useState<ExternalMcpCredentialMode | null>(null);
  const [apiKeyAuthScheme, setApiKeyAuthScheme] = useState<ExternalMcpApiKeyAuthScheme>(DEFAULT_API_KEY_AUTH_SCHEME);
  const [draft, setDraft] = useState<AccessDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSwitch, setConfirmSwitch] = useState(false);
  const setup = useConnectorSetup({
    mode: "admin",
    target,
    initialConnectionId: searchParams.get("connection"),
    onConnectionCreated: (connectionId) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("connection", connectionId);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
  });

  const name = target?.name ?? "";
  const back = { href: getAddConnectorRoute(orgSlug), label: t("denConnector.action.addConnector") };

  if (missing || failed) {
    return (
      <ItemPage>
        <ItemHeader
          back={back}
          title={failed ? t("denConnector.page.listNotLoaded") : t("denConnector.page.notFoundTitle")}
          description={failed ? t("denPlugin.error.reloadToRetry") : t("denConnector.page.pickAgainFromList")}
        />
      </ItemPage>
    );
  }
  if (!target || !orgContext) {
    return <ItemPage><ItemHeader back={back} title={loading || !orgContext ? "Loading..." : t("denConnector.action.addConnector")} /></ItemPage>;
  }

  const connection = setup.connection;
  const signsIn = connection ? connection.authType === "oauth" : true;
  const usesKey = connection?.authType === "apikey";
  const usesIndividualKeys = Boolean(connection && usesMemberApiKey(connection));
  const chosenMode: ExternalMcpCredentialMode = mode ?? connection?.credentialMode ?? (setup.method === "api_key" ? "shared" : "per_member");
  const access: AccessDraft = draft ?? (connection?.access
    ? { orgWide: connection.access.orgWide, memberIds: connection.access.memberIds, teamIds: connection.access.teamIds }
    : { orgWide: false, memberIds: viewerId ? [viewerId] : [], teamIds: [] });
  const reached = accessPeopleIds(access, orgContext, viewerId).length;
  const me = orgContext.members.find((member) => member.id === viewerId);
  const viewerName = me?.user.name || me?.user.email || t("denPlugin.item.you");
  const switchingToShared = signsIn && chosenMode === "shared" && connection?.credentialMode === "per_member";
  const ready = setup.allDone && Boolean(connection);

  const checks = setup.checks.map((check) => {
    if (check.id === "sign-in" && setup.canSignIn) {
      return { ...check, action: <DenButton size="sm" onClick={() => void setup.startSignIn()}>{t("denConnector.action.signInWith", { name })}</DenButton> };
    }
    if (check.id === "sign-in-method" && setup.needsInput) {
      return {
        ...check,
        body: setup.method === "api_key"
          ? (
            <div className="flex flex-col gap-3">
              <SignInChoice name={name} value={chosenMode} onChange={setMode} disabled={setup.saving} kind="api_key" />
              <ApiKeySchemeAdvanced value={apiKeyAuthScheme} onChange={setApiKeyAuthScheme} disabled={setup.saving} testId="connector-setup-api-key-auth-scheme" />
              {chosenMode === "shared" ? (
                <ApiKeyFields name={name} saving={setup.saving} error={setup.saveError} onSave={(apiKey) => void setup.saveApiKey(apiKey, apiKeyAuthScheme)} />
              ) : (
                <div className="flex flex-col items-start gap-2">
                  <DenButton size="sm" loading={setup.saving} onClick={() => void setup.savePerMemberApiKeys(apiKeyAuthScheme)}>{t("denConnector.action.useIndividualKeys")}</DenButton>
                  {setup.saveError ? <p className="text-[12px] text-red-600" role="alert">{setup.saveError}</p> : null}
                </div>
              )}
            </div>
          )
          : <OAuthAppFields secretRequired={setup.secretRequired} saving={setup.saving} error={setup.saveError} onSave={(input) => void setup.saveOAuthApp(input)} />,
      };
    }
    return check;
  });

  async function cancel() {
    setBusy(true);
    await setup.discard();
    router.push(getMcpConnectionsRoute(orgSlug));
  }

  async function switchToShared() {
    if (!connection) return;
    await updateConnection.mutateAsync({
      connectionId: connection.id,
      expectedUpdatedAt: connection.updatedAt ?? new Date().toISOString(),
      name: connection.name,
      url: connection.url,
      authType: connection.authType,
      credentialMode: "shared",
      exposeDirectly: connection.exposeDirectly,
      access,
    });
  }

  async function add() {
    if (!connection) return;
    setBusy(true);
    setError(null);
    try {
      await saveAccess(connection.id, access);
      // Individual-key setup publishes the connection; each person's key is
      // checked when they enroll it, not against an admin's nonexistent key.
      const checked = !usesIndividualKeys
        ? await checkConnection.mutateAsync(connection.id) : null;
      const connectionId = connection.id;
      toast({
        title: usesIndividualKeys ? t("denConnector.setup.isSetUp", { name }) : checked?.status === "could_not_verify" ? t("denConnector.setup.couldNotVerify", { name }) : t("denConnector.setup.isReady", { name }),
        description: reached > 0 ? t("denConnector.setup.willFindInLibrary", { people: peopleLabel(reached) }) : t("denConnector.setup.onlyYouHaveIt"),
        action: { label: "View", onClick: () => router.push(getMcpConnectionRoute(orgSlug, connectionId)) },
      });
      router.push(getMcpConnectionsRoute(orgSlug));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("denConnector.form.notSaved"));
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <ItemPage testId="connector-setup">
        <ItemHeader
          back={back}
          logo={<ConnectorLogo name={name} url={target.url} size="md" />}
          title={t("denConnector.setup.addTitle", { name })}
        />
        <SetupChecks checks={checks} />
        <StepFooter note={t("denConnector.setup.stepOf", { step: setup.stepNumber, total: checks.length })}>
          <DenButton variant="secondary" loading={busy} onClick={() => void cancel()}>{t("denPlugin.action.cancel")}</DenButton>
        </StepFooter>
      </ItemPage>
    );
  }

  return (
    <ItemPage testId="connector-setup">
      <ItemHeader
        back={back}
        logo={<ConnectorLogo name={name} url={target.url} size="md" />}
        title={usesIndividualKeys ? t("denConnector.setup.isSetUp", { name }) : t("denConnector.setup.passedChecks", { name, count: checks.length })}
      />
      {signsIn || usesKey ? (
        <section className="flex flex-col gap-2.5">
          <SectionTitle title={t("denConnector.setup.howPeopleConnect")} />
          <SignInChoice
            name={name}
            value={chosenMode}
            onChange={setMode}
            disabled={busy || usesKey}
            kind={usesKey ? "api_key" : "oauth"}
            sharedDescription={usesKey ? t("denConnector.setup.sharedKeyDescription", { name }) : undefined}
          />
        </section>
      ) : null}
      <section className="flex flex-col gap-2.5">
        <SectionTitle title={t("denPlugin.access.whoCanUseIt")} />
        <WhoCanUseIt
          value={access}
          onChange={setDraft}
          members={orgContext.members}
          teams={orgContext.teams}
          owner={viewerId ? { id: viewerId, name: viewerName, isYou: true } : null}
          canShareWithEveryone={canShareWithEveryone}
          everyoneOffDescription={t("denConnector.setup.offBelowGetIt")}
          disabled={busy}
        />
      </section>
      {error ? <p className="text-[13px] text-red-600" role="alert">{error}</p> : null}
      <StepFooter note={switchingToShared
        ? t("denConnector.setup.nextSignInShared", { name })
        : reached > 0 ? t("denConnector.setup.willFindInLibraryNamed", { people: peopleLabel(reached), name }) : t("denConnector.setup.onlyYouWillHave", { name })}
      >
        <DenButton variant="secondary" disabled={busy} onClick={() => void cancel()}>{t("denPlugin.action.cancel")}</DenButton>
        <DenButton loading={busy} onClick={() => (switchingToShared ? setConfirmSwitch(true) : void add())}>{switchingToShared ? t("denConnector.action.continue") : t("denConnector.setup.addTitle", { name })}</DenButton>
      </StepFooter>
      <ConfirmDialog
        confirm={confirmSwitch ? {
          title: t("denConnector.setup.switchConfirmTitle"),
          description: t("denConnector.setup.switchConfirmDescription", { name }),
          action: t("denConnector.setup.signOutAndContinue"),
        } : null}
        onConfirm={switchToShared}
        onClose={() => setConfirmSwitch(false)}
      />
    </ItemPage>
  );
}
