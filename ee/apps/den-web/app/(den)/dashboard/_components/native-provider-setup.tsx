"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { DenButton } from "../../_components/ui/button";
import { DenInput } from "../../_components/ui/input";
import { getAddConnectorRoute, getMcpConnectionRoute, getMcpConnectionsRoute } from "../../_lib/den-org";
import { useOrgDashboard } from "../_providers/org-dashboard-provider";
import { GOOGLE_WORKSPACE_QUICK_ADD_ID, MICROSOFT_365_QUICK_ADD_ID, type NativeProviderKey } from "./connector-catalog";
import { useDenToast } from "./den-toast";
import { useDenT } from "../../../_lib/i18n/client";
import type { DenTranslate } from "../../../_lib/i18n/messages";
import {
  GOOGLE_WORKSPACE_DEFAULT_FEATURES,
  GOOGLE_WORKSPACE_PERMISSION_GROUPS,
  type NativePermissionGroup,
} from "./google-workspace-permissions";
import { ItemHeader, ItemPage, SectionTitle, StepFooter } from "./item-header";
import { DetailRows, ItemPanel } from "./item-list";
import { ConnectorLogo } from "./item-logo";
import { McpCredentialInput } from "./mcp-credential-input";
import { useCreateNativeProviderConnection, useNativeProviderClient, useSaveNativeProviderClient } from "./mcp-connections-data";
import { MICROSOFT_365_DEFAULT_FEATURES, MICROSOFT_365_PERMISSION_GROUPS } from "./microsoft-365-permissions";

type ProviderCopy = {
  name: string;
  url: string;
  consoleLabel: string;
  consoleUrl: string;
  defaultFeatures: readonly string[];
  groups: readonly NativePermissionGroup[];
  tenant: boolean;
  clientIdPlaceholder: string;
  secretPlaceholder: string;
};

function getProviders(t: DenTranslate): Record<NativeProviderKey, ProviderCopy> {
  return {
  [GOOGLE_WORKSPACE_QUICK_ADD_ID]: {
    name: "Google Workspace",
    url: "https://workspace.google.com",
    consoleLabel: t("denConnector.nativeProvider.googleConsoleLabel"),
    consoleUrl: "https://console.cloud.google.com/apis/credentials",
    defaultFeatures: GOOGLE_WORKSPACE_DEFAULT_FEATURES,
    groups: GOOGLE_WORKSPACE_PERMISSION_GROUPS,
    tenant: false,
    clientIdPlaceholder: "1234567890-abc.apps.googleusercontent.com",
    secretPlaceholder: t("denConnector.setupFields.clientSecretLabel"),
  },
  [MICROSOFT_365_QUICK_ADD_ID]: {
    name: "Microsoft 365",
    url: "https://www.microsoft.com/microsoft-365",
    consoleLabel: t("denConnector.nativeProvider.entraConsoleLabel"),
    consoleUrl: "https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade",
    defaultFeatures: MICROSOFT_365_DEFAULT_FEATURES,
    groups: MICROSOFT_365_PERMISSION_GROUPS,
    tenant: true,
    clientIdPlaceholder: "Application (client) ID",
    secretPlaceholder: t("denConnector.nativeProvider.entraSecretPlaceholder"),
  },
  };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

/**
 * The org OAuth app and permissions for Google Workspace or Microsoft 365.
 * `create` adds a new Google Workspace connection; otherwise it saves the
 * client for `clientProviderId` (a connection id or the provider alias).
 */
export function NativeProviderSettings({ providerKey, clientProviderId, create, onSaved, footer }: {
  providerKey: NativeProviderKey;
  clientProviderId: string;
  create: boolean;
  onSaved: (connectionId: string, name: string) => void;
  footer: (input: { save: () => void; saving: boolean; disabled: boolean; label: string }) => ReactNode;
}) {
  const t = useDenT();
  const provider = getProviders(t)[providerKey];
  const clientConfig = useNativeProviderClient(clientProviderId, true);
  const createNative = useCreateNativeProviderConnection();
  const saveClient = useSaveNativeProviderClient();
  const [name, setName] = useState(provider.name);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [features, setFeatures] = useState<string[]>([...provider.defaultFeatures]);
  const [replacing, setReplacing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prefilled = useRef(false);

  const creatingGoogle = create && providerKey === GOOGLE_WORKSPACE_QUICK_ADD_ID;
  const configured = !creatingGoogle && (clientConfig.data?.configured ?? false);

  useEffect(() => {
    if (!configured || prefilled.current || !clientConfig.data) return;
    prefilled.current = true;
    setFeatures(clientConfig.data.features);
  }, [clientConfig.data, configured]);

  const redirectUri = clientConfig.data?.redirectUri ?? "";
  const showCredentials = !clientConfig.isLoading && (!configured || replacing);
  const saving = createNative.isPending || saveClient.isPending;
  const credentialsIncomplete = showCredentials && (!clientId.trim() || !clientSecret.trim() || (provider.tenant && !tenantId.trim()));
  const disabled = clientConfig.isLoading || saving || credentialsIncomplete || (creatingGoogle && !name.trim());
  const label = configured && !replacing ? t("denConnector.nativeProvider.savePermissionsLabel") : configured ? t("denConnector.nativeProvider.saveCredentialsLabel") : t("denConnector.setup.addTitle", { name: provider.name });

  function toggle(feature: string) {
    setFeatures((current) => current.includes(feature) ? current.filter((entry) => entry !== feature) : [...current, feature]);
  }

  async function copy() {
    if (!redirectUri) return;
    try {
      await navigator.clipboard.writeText(redirectUri);
      setCopied(true);
    } catch {
      setError(t("denConnector.nativeProvider.copyFailed"));
    }
  }

  async function save() {
    setError(null);
    const credentials = showCredentials
      ? { clientId: clientId.trim(), clientSecret: clientSecret.trim(), ...(provider.tenant ? { tenantId: tenantId.trim() } : {}) }
      : {};
    try {
      if (creatingGoogle) {
        const created = await createNative.mutateAsync({
          nativeProviderKey: providerKey,
          name: name.trim(),
          oauthClient: { clientId: clientId.trim(), clientSecret: clientSecret.trim(), features },
        });
        onSaved(created.id, created.name || name.trim());
        return;
      }
      await saveClient.mutateAsync({ providerId: clientProviderId, ...credentials, features });
      setReplacing(false);
      setClientSecret("");
      onSaved(clientProviderId, provider.name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("denConnector.form.notSaved"));
    }
  }

  return (
    <div className="flex flex-col gap-6" data-testid={`native-provider-${providerKey}`}>
      {creatingGoogle ? (
        <section className="flex flex-col gap-2.5">
          <SectionTitle title={t("denMarketplace.detail.nameLabel")} />
          <DenInput value={name} onChange={(event) => setName(event.target.value)} aria-label={t("denMarketplace.detail.nameLabel")} placeholder={provider.name} />
        </section>
      ) : null}

      <section className="flex flex-col gap-2.5">
        <SectionTitle
          title={t("denInference.editor.redirectUriLabel")}
          meta={<a href={provider.consoleUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-gray-600 underline-offset-2 hover:text-gray-900 hover:underline">{provider.consoleLabel}</a>}
        />
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate rounded-lg border border-gray-200 bg-white px-3 py-2.5 font-mono text-[12px] text-gray-900" data-testid="native-provider-redirect-uri">
            {redirectUri || (clientConfig.error ? t("denConnector.nativeProvider.addressLoadFailed") : t("denShell.workspace.loading"))}
          </p>
          <DenButton variant="secondary" size="sm" disabled={!redirectUri} onClick={() => void copy()}>{copied ? t("denOrgSettings.copied") : t("denOrgSettings.copy")}</DenButton>
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <SectionTitle
          title={t("denConnector.nativeProvider.oAuthAppTitle")}
          meta={configured && !replacing ? (
            <button type="button" className="font-medium text-gray-600 underline-offset-2 hover:text-gray-900 hover:underline" onClick={() => {
              setClientId(clientConfig.data?.clientId ?? "");
              setTenantId(clientConfig.data?.tenantId ?? "");
              setClientSecret("");
              setReplacing(true);
            }}>{t("denConnector.nativeProvider.replaceCredentialsAction")}</button>
          ) : replacing ? (
            <button type="button" className="font-medium text-gray-600 underline-offset-2 hover:text-gray-900 hover:underline" onClick={() => setReplacing(false)}>{t("denConnector.nativeProvider.keepSavedAction")}</button>
          ) : undefined}
        />
        {clientConfig.isLoading ? <ItemPanel><p className="px-5 py-3 text-[13px] text-gray-500">{t("denConnector.nativeProvider.checkingSaved")}</p></ItemPanel> : null}
        {configured && !replacing ? (
          <DetailRows rows={[
            ...(provider.tenant ? [{ label: t("denConnector.nativeProvider.tenantIdLabel"), value: <span className="font-mono">{clientConfig.data?.tenantId ?? t("denConnector.nativeProvider.savedValue")}</span> }] : []),
            { label: t("denMarketplace.setup.clientIdLabel"), value: <span className="font-mono">{clientConfig.data?.clientId ?? t("denConnector.nativeProvider.savedValue")}</span> },
            { label: t("denConnector.setupFields.clientSecretLabel"), value: t("denConnector.nativeProvider.savedValue") },
          ]} />
        ) : null}
        {showCredentials ? (
          <div className="flex flex-col gap-3">
            {provider.tenant ? (
              <Field label={t("denInference.editor.tenantIdLabel")}>
                <McpCredentialInput kind="identifier" name={`${providerKey}-tenant-id`} data-testid="native-provider-tenant-id" value={tenantId} onChange={(event) => setTenantId(event.target.value)} placeholder="00000000-0000-0000-0000-000000000000" />
              </Field>
            ) : null}
            <Field label={t("denMarketplace.setup.clientIdLabel")}>
              <McpCredentialInput kind="identifier" name={`${providerKey}-oauth-client-id`} data-testid="native-provider-client-id" value={clientId} onChange={(event) => setClientId(event.target.value)} placeholder={provider.clientIdPlaceholder} />
            </Field>
            <Field label={t("denConnector.setupFields.clientSecretLabel")}>
              <McpCredentialInput kind="secret" name={`${providerKey}-oauth-client-secret`} data-testid="native-provider-client-secret" value={clientSecret} onChange={(event) => setClientSecret(event.target.value)} placeholder={provider.secretPlaceholder} />
            </Field>
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-2.5">
        <SectionTitle title={t("denConnector.capabilities.title")} meta={t("denConnector.nativeProvider.enabledCount", { count: features.length })} />
        <ItemPanel>
          {provider.groups.map((group) => (
            <fieldset key={group.name} className="flex flex-col gap-2 px-5 py-3.5">
              <legend className="sr-only">{group.name}</legend>
              <p className="text-[13px] font-medium text-gray-900" aria-hidden>{group.name}</p>
              {group.permissions.map((permission) => (
                <label key={permission.key} className="flex items-start gap-2.5 text-[13px] leading-5 text-gray-700">
                  <input
                    type="checkbox"
                    data-feature={permission.key}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-gray-900"
                    checked={features.includes(permission.key)}
                    disabled={clientConfig.isLoading || saving}
                    onChange={() => toggle(permission.key)}
                  />
                  <span className="flex flex-col">
                    <span>{permission.label}</span>
                    {permission.detail ? <span className="text-[12px] leading-4 text-gray-500">{permission.detail}</span> : null}
                  </span>
                </label>
              ))}
            </fieldset>
          ))}
        </ItemPanel>
      </section>

      {error ? <p className="text-[13px] text-red-600" role="alert">{error}</p> : null}
      {footer({ save: () => void save(), saving, disabled, label })}
    </div>
  );
}

/** Add Google Workspace or Microsoft 365 as a full page: one OAuth app, then each person signs in. */
export function NativeProviderSetupScreen({ providerKey }: { providerKey: NativeProviderKey }) {
  const t = useDenT();
  const router = useRouter();
  const toast = useDenToast();
  const { orgSlug } = useOrgDashboard();
  const provider = getProviders(t)[providerKey];
  return (
    <ItemPage testId="connector-setup">
      <ItemHeader
        back={{ href: getAddConnectorRoute(orgSlug), label: t("denConnector.action.addConnector") }}
        logo={<ConnectorLogo name={provider.name} url={provider.url} size="md" />}
        title={t("denConnector.setup.addTitle", { name: provider.name })}
      />
      <NativeProviderSettings
        providerKey={providerKey}
        clientProviderId={providerKey}
        create
        onSaved={(connectionId, name) => {
          toast({ title: t("denConnector.setup.isReady", { name }), description: t("denConnector.nativeProvider.perMemberDescription") });
          router.push(getMcpConnectionRoute(orgSlug, connectionId));
        }}
        footer={({ save, saving, disabled, label }) => (
          <StepFooter note={t("denConnector.nativeProvider.perMemberNote")}>
            <DenButton variant="secondary" disabled={saving} onClick={() => router.push(getMcpConnectionsRoute(orgSlug))}>{t("denCommon.action.cancel")}</DenButton>
            <DenButton loading={saving} disabled={disabled} onClick={save} data-testid="native-provider-save">{label}</DenButton>
          </StepFooter>
        )}
      />
    </ItemPage>
  );
}
