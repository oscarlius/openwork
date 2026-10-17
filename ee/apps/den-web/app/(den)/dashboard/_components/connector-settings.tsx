"use client";

import { Lock } from "lucide-react";
import { type ReactNode, useState } from "react";
import { DenButton } from "../../_components/ui/button";
import { DenSelect } from "../../_components/ui/select";
import { DenInput } from "../../_components/ui/input";
import { useDenT } from "../../../_lib/i18n/client";
import { ApiKeySchemeAdvanced } from "./connector-setup-fields";
import { ConfirmDialog } from "./item-list";
import { credentialModeForAuth } from "./member-api-key";
import { McpCredentialInput } from "./mcp-credential-input";
import { apiKeyAuthSchemeInput, type ExternalMcpApiKeyAuthScheme, type ExternalMcpAuthType, type ExternalMcpCredentialMode, type ExternalMcpConnection, type McpIssuerReview, type UpdateMcpConnectionInput, useReviewMcpIssuer, useUpdateMcpConnection } from "./mcp-connections-data";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

/** Rename a connector, move its address, rotate its key, or replace its OAuth app, in place on its page. */
/** `lockedReason` shows the settings read-only with why (DESIGN.md P4), e.g. the caller can't edit this connection. */
export function ConnectorSettingsForm({ connection, onSaved, lockedReason = null }: { connection: ExternalMcpConnection; onSaved: (message: string) => void; lockedReason?: string | null }) {
  const t = useDenT();
  const updateConnection = useUpdateMcpConnection();
  const [name, setName] = useState(connection.name);
  const [url, setUrl] = useState(connection.url);
  const [authType, setAuthType] = useState<ExternalMcpAuthType>(connection.authType);
  const [credentialMode, setCredentialMode] = useState<ExternalMcpCredentialMode>(connection.credentialMode);
  const [apiKeyAuthScheme, setApiKeyAuthScheme] = useState<ExternalMcpApiKeyAuthScheme>(connection.apiKeyAuthScheme);
  const [showOAuthApp, setShowOAuthApp] = useState(Boolean(connection.oauthClientId) || connection.oauthClientRequired === true);
  const [scopes, setScopes] = useState((connection.requestedScopes ?? []).join(" "));
  const [exposeDirectly, setExposeDirectly] = useState(connection.exposeDirectly);
  const [apiKey, setApiKey] = useState("");
  const [clientId, setClientId] = useState(connection.oauthClientId ?? "");
  const [clientSecret, setClientSecret] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const managedByPlugin = connection.identityManagedBy.length > 0;
  const usesKey = authType === "apikey";
  const usesOAuthApp = authType === "oauth" && showOAuthApp;
  const chosenMode = credentialModeForAuth(authType, credentialMode);
  const usesSharedKey = usesKey && chosenMode === "shared";
  const usesPersonalKey = usesKey && chosenMode === "per_member";
  const normalizedApiKey = apiKey.trim();
  const identityChanged = url.trim() !== connection.url
    || authType !== connection.authType
    || chosenMode !== connection.credentialMode
    || (usesKey && apiKeyAuthScheme !== connection.apiKeyAuthScheme);
  const requestedScopes = [...new Set(scopes.split(/[\s,]+/).filter(Boolean))];
  const scopesChanged = requestedScopes.join(" ") !== (connection.requestedScopes ?? []).join(" ");
  const clientChanged = usesOAuthApp && (clientId.trim() !== (connection.oauthClientId ?? "") || Boolean(clientSecret.trim()));
  const changed = name.trim() !== connection.name || identityChanged || Boolean(usesSharedKey && normalizedApiKey) || clientChanged || scopesChanged || exposeDirectly !== connection.exposeDirectly;
  const keyRequired = usesSharedKey && identityChanged && !normalizedApiKey;
  const disabled = !changed || !name.trim() || !url.trim() || keyRequired || (clientChanged && !clientId.trim()) || !connection.updatedAt;

  async function save() {
    if (!connection.updatedAt) return;
    setError(null);
    const input: UpdateMcpConnectionInput = {
      connectionId: connection.id,
      expectedUpdatedAt: connection.updatedAt,
      name: name.trim(),
      url: url.trim(),
      authType,
      credentialMode: chosenMode,
      exposeDirectly,
      ...(authType === "oauth" && !managedByPlugin ? { requestedScopes } : {}),
      ...(!managedByPlugin ? apiKeyAuthSchemeInput(authType, apiKeyAuthScheme) : {}),
      ...(usesSharedKey && !managedByPlugin && normalizedApiKey ? { apiKey: normalizedApiKey } : {}),
      ...(clientChanged && clientId.trim()
        ? { oauthClient: { clientId: clientId.trim(), ...(clientSecret.trim() ? { clientSecret: clientSecret.trim() } : {}) } }
        : {}),
      access: connection.access ?? { orgWide: false, memberIds: [], teamIds: [] },
    };
    try {
      const updated = await updateConnection.mutateAsync(input);
      setApiKey("");
      setClientSecret("");
      onSaved(usesPersonalKey
        ? t("denConnector.settings.savedPersonalKey", { name: updated.name })
        : updated.reconnectionRequired ? t("denConnector.settings.savedReconnect", { name: updated.name }) : t("denConnector.settings.saved", { name: updated.name }));
    } catch (cause) {
      setError(usesPersonalKey
        ? t("denConnector.settings.errorPersonalKey")
        : cause instanceof Error ? cause.message : t("denConnector.settings.errorNotSaved"));
    }
  }

  return (
    <>
    <form
      className="flex flex-col gap-3 px-5 py-4"
      data-testid="connector-settings"
      onSubmit={(event) => {
        event.preventDefault();
        if (identityChanged) setConfirming(true);
        else void save();
      }}
    >
      <fieldset disabled={lockedReason !== null} className="flex min-w-0 flex-col gap-3">
      <Field label={t("denConnector.settings.nameLabel")}>
        <DenInput value={name} onChange={(event) => setName(event.target.value)} data-testid="connector-settings-name" />
      </Field>
      <Field label={t("denConnector.settings.addressLabel")}>
        <DenInput value={url} onChange={(event) => setUrl(event.target.value)} disabled={managedByPlugin} data-testid="connector-settings-url" />
      </Field>
      {managedByPlugin ? <p className="text-[12px] text-gray-500">{t("denConnector.settings.managedByPluginHint")}</p> : null}
      <Field label={t("denConnector.settings.signInMethodLabel")}>
        <DenSelect value={authType} disabled={managedByPlugin} onChange={(event) => {
          const value = event.target.value;
          if (value === "oauth" || value === "apikey" || value === "none") setAuthType(value);
        }}>
          <option value="oauth">{t("denConnector.settings.optionOAuthAccount")}</option>
          <option value="apikey">{t("denConnector.settings.optionApiKey")}</option>
          <option value="none">{t("denConnector.settings.optionNone")}</option>
        </DenSelect>
      </Field>
      <Field label={t("denConnector.settings.credentialModeLabel")}>
        <DenSelect value={chosenMode} disabled={managedByPlugin || authType === "none"} onChange={(event) => {
          const value = event.target.value;
          if (value === "per_member" || value === "shared") setCredentialMode(value);
        }}>
          <option value="per_member">{usesKey ? t("denConnector.settings.optionPersonalKey") : t("denConnector.settings.optionPersonalSignIn")}</option>
          <option value="shared">{usesKey ? t("denConnector.settings.optionSharedKey") : t("denConnector.settings.optionSharedAccount")}</option>
        </DenSelect>
      </Field>
      {authType === "none" ? <p className="text-[12px] text-gray-500">{t("denConnector.settings.sharedConnectionHint")}</p> : null}
      {usesKey ? (
        <ApiKeySchemeAdvanced value={apiKeyAuthScheme} onChange={setApiKeyAuthScheme} disabled={managedByPlugin} testId="connector-settings-api-key-auth-scheme" />
      ) : null}
      {authType === "oauth" && !showOAuthApp ? <DenButton type="button" variant="secondary" size="sm" onClick={() => setShowOAuthApp(true)}>{t("denConnector.settings.addOAuthApp")}</DenButton> : null}
      {usesSharedKey && !managedByPlugin ? (
        <Field label={keyRequired ? t("denConnector.settings.newApiKeyLabel") : t("denConnector.settings.newApiKeyOptionalLabel")}>
          <McpCredentialInput kind="secret" name="connector-settings-api-key" autoComplete="off" data-ph-no-capture value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={t("denConnector.settings.apiKeyKeepPlaceholder")} data-testid="connector-settings-api-key" />
        </Field>
      ) : null}
      {usesOAuthApp ? (
        <>
          <Field label={t("denConnector.settings.oauthClientIdLabel")}>
            <McpCredentialInput kind="identifier" name="connector-settings-client-id" value={clientId} onChange={(event) => setClientId(event.target.value)} placeholder={t("denConnector.settings.clientIdPlaceholder")} />
          </Field>
          <Field label={t("denConnector.settings.newClientSecretLabel")}>
            <McpCredentialInput kind="secret" name="connector-settings-client-secret" value={clientSecret} onChange={(event) => setClientSecret(event.target.value)} placeholder={t("denConnector.settings.clientSecretKeepPlaceholder")} />
          </Field>
        </>
      ) : null}
      {authType === "oauth" ? (
        <Field label={t("denConnector.settings.oauthScopesLabel")}>
          <DenInput value={scopes} disabled={managedByPlugin} onChange={(event) => setScopes(event.target.value)} placeholder="records.read records.write" data-testid="connector-settings-scopes" />
        </Field>
      ) : null}
      <label className="flex items-center gap-2 text-[13px] text-gray-700">
        <input type="checkbox" checked={exposeDirectly} onChange={(event) => setExposeDirectly(event.target.checked)} />
        {t("denConnector.settings.exposeDirectlyLabel")}
      </label>
      </fieldset>
      {error ? <p className="text-[13px] text-red-600" role="alert">{error}</p> : null}
      <div className="flex items-center justify-end gap-3">
        {lockedReason ? (
          <p className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] text-gray-500" data-testid="connector-settings-locked">
            <Lock className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
            {lockedReason}
          </p>
        ) : null}
        <DenButton type="submit" size="sm" loading={updateConnection.isPending} disabled={disabled || lockedReason !== null}>{t("denConnector.settings.saveChanges")}</DenButton>
      </div>
    </form>
    {connection.authType === "oauth" ? <ConnectorIssuerReview connection={connection} onSaved={onSaved} /> : null}
    <ConfirmDialog
        confirm={confirming ? {
          title: t("denConnector.settings.confirmTitle", { name: connection.name }),
          description: t("denConnector.settings.confirmDescription"),
          action: t("denConnector.settings.confirmAction"),
        } : null}
        onConfirm={save}
        onClose={() => setConfirming(false)}
      />
    </>
  );
}

/** Review changed authorization servers before allowing a fresh sign-in. */
function ConnectorIssuerReview({ connection, onSaved }: { connection: ExternalMcpConnection; onSaved: (message: string) => void }) {
  const t = useDenT();
  const review = useReviewMcpIssuer();
  const [preview, setPreview] = useState<McpIssuerReview | null>(null);
  const [issuer, setIssuer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function inspect() {
    setError(null);
    try {
      const result = await review.mutateAsync({ connectionId: connection.id, action: "preview" });
      setPreview(result);
      setIssuer(result.advertisedIssuers.includes(result.currentIssuer ?? "") ? result.currentIssuer ?? "" : result.advertisedIssuers[0] ?? "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("denConnector.settings.issuerLoadFailed"));
    }
  }

  async function confirm() {
    if (!issuer || !connection.updatedAt) return;
    const result = await review.mutateAsync({ connectionId: connection.id, action: "confirm", expectedUpdatedAt: connection.updatedAt, authorizationServerIssuer: issuer });
    setPreview(null);
    onSaved(result.reconnectionRequired ? t("denConnector.settings.issuerSavedReconnect") : t("denConnector.settings.issuerConfirmed"));
  }

  return (
    <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4">
      {connection.issuerReviewRequired ? <p className="text-[13px] text-gray-600">{t("denConnector.settings.issuerChangedNotice")}</p> : null}
      <DenButton type="button" variant="secondary" size="sm" loading={review.isPending} onClick={() => void inspect()}>{t("denConnector.settings.reviewIssuerAction")}</DenButton>
      {preview ? <>
        <p className="text-[12px] text-gray-500">{t("denConnector.settings.savedIssuer", { issuer: preview.currentIssuer ?? t("denConnector.settings.issuerNone") })}</p>
        <Field label={t("denConnector.settings.issuerLabel")}>
          <DenSelect value={issuer} onChange={(event) => setIssuer(event.target.value)}>
            {preview.advertisedIssuers.map((value) => <option key={value} value={value}>{value}</option>)}
          </DenSelect>
        </Field>
        {preview.advertisedIssuers.length === 0 ? <p className="text-[12px] text-gray-500">{t("denConnector.settings.issuerNotFound")}</p> : null}
        <DenButton type="button" size="sm" disabled={!issuer || !connection.updatedAt || review.isPending} onClick={() => setConfirming(true)}>{t("denConnector.settings.saveIssuerAction")}</DenButton>
      </> : null}
      {error ? <p className="text-[12px] text-red-600" role="alert">{error}</p> : null}
      <ConfirmDialog confirm={confirming ? { title: t("denConnector.settings.confirmIssuerTitle", { name: connection.name }), description: t("denConnector.settings.confirmIssuerDescription", { issuer }), action: t("denConnector.settings.saveIssuerAction") } : null} onConfirm={confirm} onClose={() => setConfirming(false)} />
    </div>
  );
}
