"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Check, Globe, LockKeyhole, Plus, Search, User, Users } from "lucide-react";
import type { GatewayAccessGrantWrite, GatewayCredentialSetWrite } from "@openwork/types/den/gateway";
import { createAuditOperationContext, type AuditOperationContext } from "@openwork/types/den/audit";
import { DenBrandMark } from "../../_components/ui/brand-mark";
import { DenButton, buttonVariants } from "../../_components/ui/button";
import { DenCombobox } from "../../_components/ui/combobox";
import { DenInput } from "../../_components/ui/input";
import { DenNotice } from "../../_components/ui/notice";
import { DenSegmented } from "../../_components/ui/segmented";
import { DenSkeleton } from "../../_components/ui/skeleton";
import { DenStickyActionBar } from "../../_components/ui/sticky-action-bar";
import { DenSwitch } from "../../_components/ui/switch";
import { DenTextarea } from "../../_components/ui/textarea";
import { getAiGatewayProvidersRoute, getNewAiGatewayProviderRoute } from "../../_lib/den-org";
import { useDenT } from "../../../_lib/i18n/client";
import type { DenMessageKey } from "../../../_lib/i18n/messages";
import { gatewayMemberSignInMethod } from "@openwork/types/den/inference";
import { useOrgDashboard } from "../_providers/org-dashboard-provider";
import { ConfirmDialog } from "./item-list";
import { deleteGatewayResource, deleteInferenceProvider, saveGatewayResource, saveInferenceProvider, useInferenceProvider, useOrgInferenceProviders } from "./inference-provider-data";
import {
  accessFromGrants, buildInferenceProviderRequestBody, EMPTY_AWS_SSO, getAwsKeysError, getAwsSsoError, getMemberSignInBrand, getMemberSignInMethod, getReusableAwsKeyProviders, getNewInferenceProviderSettings, getRequiredSettingKeys, getSettingLabel,
  isAmazonBedrockNpm, isAwsRegion, isGoogleVertexNpm, isMicrosoftTenantId, isSupportedGatewayNpm, MEMBER_SIGN_IN_DOC_URLS, trimAwsSso, type AwsKeysInput, type AwsSsoInput,
} from "./inference-provider-request";
import { LITELLM_PROVIDER_ID } from "./litellm-provider-data";
import { LiteLlmProviderScreen } from "./litellm-provider-screen";
import { formatProviderTimestamp, getProviderDocUrl, getProviderEnvNames, getProviderIconSlug, getProviderNpmPackage, requestLlmProviderCatalogDetail, type DenModelsDevProviderDetail } from "./llm-provider-data";
import { normalizeAzureResourceNameInput } from "./llm-provider-guided";
import type { ProviderAccessValue } from "./llm-provider-pickers";

const CARD = "rounded-[12px] border border-gray-100 bg-white p-4";
const CARD_TITLE = "text-[13px] font-medium text-gray-900";
const LABEL = "mt-3 block text-[12px] font-medium text-gray-700";
const MONO_INPUT = "font-mono text-[12px]";
const EMPTY_AWS_KEYS: AwsKeysInput = { accessKeyId: "", secretAccessKey: "", sessionToken: "" };
const SETTING_PLACEHOLDERS: Record<string, string> = { region: "us-east-1" };
const AWS_SSO_FIELDS: Array<{ key: keyof AwsSsoInput; labelKey: DenMessageKey; placeholder: string }> = [
  { key: "startUrl", labelKey: "denInference.editor.awsAccessPortalUrlLabel", placeholder: "https://d-xxxxxxxxxx.awsapps.com/start" },
  { key: "region", labelKey: "denInference.editor.iamIdentityRegionLabel", placeholder: "us-east-1" },
  { key: "accountId", labelKey: "denInference.editor.awsAccountIdLabel", placeholder: "123456789012" },
  { key: "roleName", labelKey: "denInference.editor.permissionSetNameLabel", placeholder: "BedrockInference" },
];

function Radio({ testId, checked, label, onSelect }: { testId: string; checked: boolean; label: string; onSelect: () => void }) {
  return (
    <label className={`flex flex-1 cursor-pointer items-center gap-2.5 rounded-[10px] border px-3 py-2.5 text-[13px] ${checked ? "border-gray-200 bg-gray-50 text-gray-900" : "border-gray-200 bg-white text-gray-600"}`}>
      <input type="radio" name="gateway-models-scope" data-testid={testId} checked={checked} onChange={onSelect} className="h-4 w-4 accent-gray-900" />
      {label}
    </label>
  );
}

export function InferenceProviderEditorScreen({ inferenceProviderId, catalogProviderId, embedded = false }: { inferenceProviderId?: string; catalogProviderId?: string; embedded?: boolean }) {
  const Heading = embedded ? "h2" : "h1";
  const t = useDenT();
  const router = useRouter();
  const { orgId, orgSlug, orgContext, runReauthableAction, reauthDialogOpen } = useOrgDashboard();
  const { provider, busy, error, reload } = useInferenceProvider(orgId, inferenceProviderId ?? null);
  const [detail, setDetail] = useState<DenModelsDevProviderDetail | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogBusy, setCatalogBusy] = useState(true);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [providerId, setProviderId] = useState(catalogProviderId ?? "");
  const [name, setName] = useState("");
  const [modelIds, setModelIds] = useState<string[]>([]);
  const [allowAllModels, setAllowAllModels] = useState(true);
  const [modelQuery, setModelQuery] = useState("");
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [credentialMode, setCredentialMode] = useState<"org" | "member">("org");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyValues, setApiKeyValues] = useState<Record<string, string>>({});
  const [serviceAccountJson, setServiceAccountJson] = useState("");
  const [awsKeys, setAwsKeys] = useState<AwsKeysInput>(EMPTY_AWS_KEYS);
  const [reuseKeysFrom, setReuseKeysFrom] = useState<string | null>(null);
  const { inferenceProviders } = useOrgInferenceProviders(orgId);
  const [oauthClientId, setOauthClientId] = useState("");
  const [oauthClientSecret, setOauthClientSecret] = useState("");
  const [oauthTenantId, setOauthTenantId] = useState("");
  const [awsSso, setAwsSso] = useState<AwsSsoInput>(EMPTY_AWS_SSO);
  const [rotationAcknowledged, setRotationAcknowledged] = useState(false);
  const [callbackCopied, setCallbackCopied] = useState(false);
  const [replacingKey, setReplacingKey] = useState(false);
  const [access, setAccess] = useState<ProviderAccessValue>({ allMembers: true, memberIds: [], teamIds: [] });
  const [adding, setAdding] = useState<"person" | "team" | null>(null);
  const [removingAccess, setRemovingAccess] = useState<{ type: "team" | "member"; id: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cancelDeleteRef = useRef<HTMLButtonElement | null>(null);
  const initializedProviderId = useRef<string | null>(null);
  const initializedNewProviderId = useRef<string | null>(null);

  useEffect(() => { if (catalogProviderId) setProviderId(catalogProviderId); }, [catalogProviderId]);

  useEffect(() => {
    if (!provider || initializedProviderId.current === provider.id) return;
    initializedProviderId.current = provider.id;
    setProviderId(provider.providerId);
    setName(provider.name);
    setModelIds(provider.modelIds ?? provider.catalogModels.map((model) => model.id));
    setAllowAllModels(provider.modelIds !== null && provider.modelIds.length === 0);
    setSettings(provider.settings);
    setCredentialMode(provider.credentialSets[0]?.credentialMode ?? provider.credentialMode);
    setOauthClientId(provider.credentialSets[0]?.oauthClientId ?? provider.oauthClientId ?? "");
    setOauthClientSecret("");
    setOauthTenantId(provider.credentialSets[0]?.oauthTenantId ?? "");
    setAwsSso(provider.credentialSets[0]?.awsSso ?? EMPTY_AWS_SSO);
    setApiKey("");
    setApiKeyValues({});
    setServiceAccountJson("");
    setAwsKeys(EMPTY_AWS_KEYS);
    setReplacingKey(false);
    setRotationAcknowledged(false);
    setCallbackCopied(false);
    setAccess(accessFromGrants(provider.accessGrants));
  }, [provider]);

  useEffect(() => {
    setDetail(null);
    setCatalogError(null);
    // LiteLLM models come from the organization's own proxy, not the shared catalog.
    if (!orgId || !providerId || providerId === LITELLM_PROVIDER_ID) { setCatalogBusy(false); return; }
    let cancelled = false;
    setCatalogBusy(true);
    void requestLlmProviderCatalogDetail(orgId, providerId)
      .then((result) => {
        if (cancelled) return;
        setDetail(result);
        if (!inferenceProviderId) {
          setName((current) => current || result.name);
          if (initializedNewProviderId.current !== providerId) {
            initializedNewProviderId.current = providerId;
            setSettings((current) => ({ ...getNewInferenceProviderSettings(getProviderNpmPackage(result.config)), ...current }));
          }
        }
      })
      .catch(() => { if (!cancelled) setCatalogError(t("denInference.editor.catalogLoadFailed")); })
      .finally(() => { if (!cancelled) setCatalogBusy(false); });
    return () => { cancelled = true; };
  }, [orgId, providerId, inferenceProviderId, catalogAttempt]);

  const npm = detail ? getProviderNpmPackage(detail.config) : null;
  const vertex = isGoogleVertexNpm(npm);
  const bedrock = isAmazonBedrockNpm(npm);
  const reusableKeyProviders = !inferenceProviderId && bedrock ? getReusableAwsKeyProviders(inferenceProviders) : [];
  const reuseSource = reusableKeyProviders.find((entry) => entry.id === reuseKeysFrom) ?? null;
  const envNames = detail ? getProviderEnvNames(detail.config) : [];
  const signInMethod = getMemberSignInMethod(providerId);
  const offeredSignInMethod = gatewayMemberSignInMethod(providerId);
  const memberSignInSupported = signInMethod !== null;
  const configuredSet = provider?.credentialSets[0] ?? null;
  const invalidatesCredentials = Boolean(configuredSet && (
    configuredSet.credentialMode !== credentialMode ||
    (credentialMode === "member" && (oauthClientId.trim() !== (configuredSet.oauthClientId ?? "") || oauthClientSecret.trim()
      || (signInMethod === "microsoft" && oauthTenantId.trim().toLowerCase() !== (configuredSet.oauthTenantId ?? ""))
      || (signInMethod === "aws_sso" && JSON.stringify(trimAwsSso(awsSso)) !== JSON.stringify(configuredSet.awsSso ?? EMPTY_AWS_SSO))))
  ));
  const keySaved = Boolean(configuredSet?.configured && configuredSet.credentialMode === credentialMode) && !replacingKey;
  const displayName = detail?.name ?? provider?.name ?? "provider";
  const formInput = {
    name, providerId, modelIds: allowAllModels ? [] : modelIds, credentialMode, status: "active" as const,
    settings, envNames, apiKey, apiKeyValues, serviceAccountJson, oauthClientId, oauthClientSecret, access,
    ...(signInMethod === "microsoft" ? { oauthTenantId } : {}), ...(signInMethod === "aws_sso" ? { awsSso } : {}),
    ...(bedrock ? { awsKeys, reuseCredentialFrom: reuseSource?.id ?? null } : {}),
  };
  const models = detail?.models ?? [];
  const filteredModels = useMemo(() => {
    const normalized = modelQuery.trim().toLowerCase();
    return normalized ? models.filter((model) => model.name.toLowerCase().includes(normalized) || model.id.toLowerCase().includes(normalized)) : models;
  }, [models, modelQuery]);
  const grantMeta = (audience: { type: "team"; teamId: string } | { type: "member"; memberId: string }) => {
    const grant = provider?.accessGrants.find((entry) => JSON.stringify(entry.audience) === JSON.stringify(audience));
    return grant ? t("denInference.editor.grantAssigned") : t("denInference.editor.grantPending");
  };

  function changeCredentialMode(mode: "org" | "member") {
    setCredentialMode(mode);
    setOauthClientSecret("");
    setApiKey("");
    setApiKeyValues({});
    setServiceAccountJson("");
    setAwsKeys(EMPTY_AWS_KEYS);
    setReuseKeysFrom(null);
    setRotationAcknowledged(false);
  }

  /** Edits go through the matrix routes: first group, first set, and one grant per audience. */
  async function syncAccessAndCredential(auditContext: AuditOperationContext) {
    if (!provider) return;
    const [group] = provider.modelGroups;
    const [set] = provider.credentialSets;
    if (!group || !set) return;
    const groupModels = allowAllModels ? (detail?.models ?? []).map((model) => model.id) : modelIds;
    if (groupModels.length) {
      await saveGatewayResource(provider.id, group.id, { resource: "model-groups", body: { name: group.name, description: group.description, modelIds: groupModels, status: "active" } }, auditContext);
    }
    const { credential, apiKeys, oauthClientId: clientId, oauthClientSecret: clientSecret, oauthTenantId: tenantId, awsSso: ssoSettings } = buildInferenceProviderRequestBody(formInput);
    if (credential || apiKeys || credentialMode === "member" || set.credentialMode !== credentialMode) {
      const body: GatewayCredentialSetWrite = { name: set.name, credentialMode, status: "active", credential, apiKeys };
      if (clientId !== undefined) body.oauthClientId = clientId;
      if (clientSecret !== undefined) body.oauthClientSecret = clientSecret;
      if (tenantId !== undefined) body.oauthTenantId = tenantId;
      if (ssoSettings !== undefined) body.awsSso = ssoSettings;
      await saveGatewayResource(provider.id, set.id, { resource: "credential-sets", body }, auditContext);
    }
    const desired: GatewayAccessGrantWrite["audience"][] = [
      ...(access.allMembers ? [{ type: "organization" as const }] : []),
      ...[...new Set(access.teamIds)].map((teamId) => ({ type: "team" as const, teamId })),
      ...[...new Set(access.memberIds)].map((memberId) => ({ type: "member" as const, memberId })),
    ];
    const same = (a: GatewayAccessGrantWrite["audience"], b: GatewayAccessGrantWrite["audience"]) => JSON.stringify(a) === JSON.stringify(b);
    const existing = provider.accessGrants.filter((grant) => grant.modelGroupId === group.id && grant.credentialSetId === set.id);
    for (const grant of existing) if (!desired.some((audience) => same(audience, grant.audience))) await deleteGatewayResource(provider.id, "access-grants", grant.id, auditContext);
    for (const audience of desired) {
      if (!existing.some((grant) => same(grant.audience, audience))) {
        await saveGatewayResource(provider.id, null, { resource: "access-grants", body: { audience, modelGroupId: group.id, credentialSetId: set.id } }, auditContext);
      }
    }
  }

  async function save() {
    setSaveError(null);
    if (invalidatesCredentials && !rotationAcknowledged) return setSaveError(t("denInference.editor.confirmRotationRequired"));
    if (catalogError) return setSaveError(t("denInference.editor.retryCatalogFirst"));
    if (!detail || detail.id !== providerId) return setSaveError(t("denInference.editor.waitCatalogLoad"));
    if (!detail.models.length) return setSaveError(t("denInference.editor.noModelsCatalog"));
    if (!isSupportedGatewayNpm(npm)) return setSaveError(t("denInference.editor.unsupportedProvider"));
    if (!allowAllModels && !modelIds.length) return setSaveError(t("denInference.editor.pickModelRequired"));
    for (const key of getRequiredSettingKeys(npm, providerId)) if (!settings[key]?.trim()) return setSaveError(t("denInference.editor.settingRequired", { label: getSettingLabel(key, providerId) }));
    if (bedrock && !isAwsRegion(settings.region?.trim() ?? "")) return setSaveError(t("denInference.editor.awsRegionRequired"));
    const awsKeysError = bedrock && !reuseSource ? getAwsKeysError(awsKeys) : null;
    if (awsKeysError) return setSaveError(awsKeysError);
    const granting = access.allMembers || access.teamIds.length > 0 || access.memberIds.length > 0;
    if (!provider && granting && credentialMode === "org") {
      const hasKey = vertex ? Boolean(serviceAccountJson.trim()) : bedrock ? Boolean(reuseSource || (awsKeys.accessKeyId.trim() && awsKeys.secretAccessKey.trim())) : envNames.length > 1 ? Object.values(apiKeyValues).some((value) => value.trim()) : Boolean(apiKey.trim());
      if (!hasKey) return setSaveError(t("denInference.editor.pasteKeyBeforeShare"));
    }
    if (credentialMode === "member") {
      if (!signInMethod) return setSaveError(t("denInference.editor.memberSignInUnsupported"));
      if (signInMethod === "aws_sso") {
        const ssoError = getAwsSsoError(awsSso);
        if (ssoError) return setSaveError(ssoError);
      } else {
        if (signInMethod === "microsoft" && !isMicrosoftTenantId(oauthTenantId)) return setSaveError(t("denInference.editor.entraTenantIdHint"));
        if (!oauthClientId.trim() || (!oauthClientSecret.trim() && !configuredSet?.hasOauthClientSecret)) {
          return setSaveError(signInMethod === "microsoft" ? t("denInference.editor.entraClientRequired") : t("denInference.editor.googleClientRequired"));
        }
      }
    }
    setSaving(true);
    const auditContext = createAuditOperationContext();
    try {
      await runReauthableAction("save-inference-provider", async () => {
        if (!provider) {
          await saveInferenceProvider({ inferenceProviderId: null, body: buildInferenceProviderRequestBody({ ...formInput, name: name.trim() || displayName }), auditContext });
        } else {
          await saveInferenceProvider({ inferenceProviderId: provider.id, body: { name: name.trim(), modelIds: allowAllModels ? [] : modelIds, status: "active" }, auditContext });
          await syncAccessAndCredential(auditContext);
          await reload();
        }
        router.push(getAiGatewayProvidersRoute(orgSlug));
        router.refresh();
      });
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : t("denInference.editor.saveFailed"));
    } finally { setSaving(false); }
  }

  async function remove() {
    if (!provider || saving) return;
    setSaving(true);
    setSaveError(null);
    const auditContext = createAuditOperationContext();
    try {
      await runReauthableAction("delete-inference-provider", async () => {
        await deleteInferenceProvider(provider.id, auditContext);
        setConfirmDelete(false);
        router.push(getAiGatewayProvidersRoute(orgSlug));
        router.refresh();
      });
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : t("denInference.editor.removeFailed"));
    } finally { setSaving(false); }
  }

  if (inferenceProviderId && !provider) {
    return (
      <div className={embedded ? undefined : "mx-auto max-w-[860px] px-6 py-6"}>
        <Link href={getAiGatewayProvidersRoute(orgSlug)} className="text-[12px] text-gray-500 hover:text-gray-900">{t("denInference.editor.backToProviders")}</Link>
        {busy ? <div className="mt-3 flex flex-col gap-3" aria-busy="true" aria-label={t("denInference.editor.loadingProvider")} data-testid="gateway-provider-loading">
          <DenSkeleton className="mb-2 h-7 w-48" />
          {[0, 1, 2].map((index) => <div key={index} className={CARD}><DenSkeleton className="h-4 w-24" /><DenSkeleton className="mt-3 h-8 w-full" /><DenSkeleton className="mt-3 h-8 w-full" /></div>)}
        </div> : <DenNotice className="mt-4" tone="error" message={error ? t("denInference.editor.loadFailed") : t("denInference.editor.notFound")} action={<DenButton size="sm" variant="secondary" onClick={() => void reload()}>{t("denInference.editor.retry")}</DenButton>} />}
      </div>
    );
  }
  if (provider?.providerId === LITELLM_PROVIDER_ID) return <LiteLlmProviderScreen provider={provider} reload={reload} embedded={embedded} />;

  const teams = orgContext?.teams ?? [];
  const members = orgContext?.members ?? [];
  const teamOptions = teams.filter((team) => !access.teamIds.includes(team.id)).map((team) => ({ value: team.id, label: team.name, description: `${team.memberIds.length} ${team.memberIds.length === 1 ? t("denInference.editor.memberOne") : t("denInference.editor.memberOther")}` }));
  const memberOptions = members.filter((member) => !access.memberIds.includes(member.id)).map((member) => ({ value: member.id, label: member.user.name, description: member.user.email }));

  return (
    <div className={embedded ? "pb-28" : "mx-auto max-w-[860px] px-6 py-6 pb-28"}>
      <nav className="text-[12px] text-gray-500" aria-label={t("denInference.editor.breadcrumb")}>
        <Link href={getAiGatewayProvidersRoute(orgSlug)} className="hover:text-gray-900">{t("denInference.editor.aiProviders")}</Link>
        {!provider ? <><span className="mx-1.5 text-gray-300">/</span><Link href={getNewAiGatewayProviderRoute(orgSlug)} className="hover:text-gray-900">{t("denInference.editor.addProvider")}</Link></> : null}
        <span className="mx-1.5 text-gray-300">/</span><span className="text-gray-900">{displayName}</span>
      </nav>
      <div className="mt-3 flex items-center gap-3">
        <DenBrandMark name={displayName} simpleIconSlug={getProviderIconSlug(providerId)} serviceUrl={detail?.doc ?? (provider ? getProviderDocUrl(provider.providerConfig) : null)} className="h-8 w-8 rounded-[8px]" imageClassName="h-4 w-4" />
        <Heading className="text-[20px] font-medium tracking-[-0.02em] text-gray-900" data-testid="gateway-provider-title">{provider ? provider.name : t("denInference.editor.addProviderNamed", { name: displayName })}</Heading>
      </div>
      {saveError ? <DenNotice tone="error" message={saveError} className="mt-4" /> : null}
      {provider?.catalogWarning ? <DenNotice tone="warning" message={provider.catalogWarning} className="mt-4" /> : null}

      <section className={`${CARD} mt-5`} aria-labelledby="gateway-key-heading">
        <h2 id="gateway-key-heading" className={CARD_TITLE}>{t("denInference.editor.keyHeading")}</h2>
        <DenSegmented<"org" | "member"> className="mt-3" aria-label={t("denInference.editor.credentialModeLabel")} value={credentialMode} options={[
          { value: "org", label: t("denInference.editor.sharedApiKey") },
          { value: "member", label: t("denInference.editor.eachMemberSignIn"), disabled: !memberSignInSupported },
        ]} onChange={changeCredentialMode} />
        {!memberSignInSupported ? <p className="mt-3 flex items-center gap-2 text-sm text-[var(--dls-text-secondary)]" data-testid="gateway-member-sign-in-locked"><LockKeyhole aria-hidden="true" className="size-4" strokeWidth={1.5} />{offeredSignInMethod ? t("denInference.editor.brandSignInOff", { brand: getMemberSignInBrand(offeredSignInMethod) }) : t("denInference.editor.memberSignInUnsupported")}</p> : null}
        {getRequiredSettingKeys(npm, providerId).map((key) => (
          <label key={key} className={LABEL}>
            {getSettingLabel(key, providerId)}
            <DenInput className={`mt-1.5 ${MONO_INPUT}`} readOnly={Boolean(provider)} value={settings[key] ?? ""} placeholder={SETTING_PLACEHOLDERS[key]} data-testid={`gateway-setting-${key}`}
              onChange={(event) => setSettings((current) => ({ ...current, [key]: key === "resourceName" ? normalizeAzureResourceNameInput(event.target.value) : event.target.value }))} />
          </label>
        ))}
        {invalidatesCredentials ? <label className="mt-3 flex items-center gap-3"><DenSwitch checked={rotationAcknowledged} onChange={setRotationAcknowledged} aria-label={t("denInference.editor.confirmInvalidationLabel")} /><span>{t("denInference.editor.invalidateNotice")}</span></label> : null}
        {credentialMode === "member" && signInMethod === "aws_sso" ? (
          <>
            {AWS_SSO_FIELDS.map((field) => (
              <label key={field.key} className={LABEL}>{t(field.labelKey)}
                <DenInput className={`mt-1.5 ${MONO_INPUT}`} data-testid={`gateway-aws-sso-${field.key}`} value={awsSso[field.key]} autoComplete="off" placeholder={field.placeholder}
                  onChange={(event) => { const value = event.target.value; setAwsSso((current) => ({ ...current, [field.key]: value })); setRotationAcknowledged(false); }} />
              </label>
            ))}
            <Link href={MEMBER_SIGN_IN_DOC_URLS.aws_sso} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "secondary", size: "sm", className: "mt-3 w-fit" })}>{t("denInference.editor.readSetupInstructions")}</Link>
          </>
        ) : credentialMode === "member" ? (
          <>
            {provider?.oauthCallbackUrl ? <div className="flex flex-wrap items-center gap-3 border-b border-[var(--dls-border)] py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1"><p className="text-sm font-medium">{signInMethod === "microsoft" ? t("denInference.editor.redirectUriLabel") : t("denInference.editor.callbackUrlLabel")}</p><code className="break-all text-xs text-[var(--dls-text-secondary)]">{provider.oauthCallbackUrl}</code></div>
              <DenButton size="sm" variant="secondary" onClick={() => {
                const callback = provider.oauthCallbackUrl;
                if (!callback) return;
                if (!navigator.clipboard) { setSaveError(t("denInference.editor.clipboardUnavailable")); return; }
                void navigator.clipboard.writeText(callback).then(() => setCallbackCopied(true)).catch(() => setSaveError(t("denInference.editor.copyCallbackFailed")));
              }}>{callbackCopied ? t("denInference.editor.callbackCopied") : t("denInference.editor.copyCallbackUrl")}</DenButton>
            </div> : <DenNotice className="mt-3" tone="neutral" message={provider ? t("denInference.editor.callbackUnavailableNotice") : signInMethod === "microsoft"
              ? t("denInference.editor.saveForRedirectUri")
              : t("denInference.editor.saveForCallbackUrl")} />}
            {signInMethod === "microsoft" ? <label className={LABEL}>{t("denInference.editor.tenantIdLabel")}<DenInput className={`mt-1.5 ${MONO_INPUT}`} data-testid="gateway-oauth-tenant-id" value={oauthTenantId} autoComplete="off" placeholder="00000000-0000-0000-0000-000000000000" onChange={(event) => { setOauthTenantId(event.target.value); setRotationAcknowledged(false); }} /></label> : null}
            <label className={LABEL}>{signInMethod === "microsoft" ? t("denInference.editor.applicationClientIdLabel") : "OAuth client ID"}<DenInput className={`mt-1.5 ${MONO_INPUT}`} data-testid="gateway-oauth-client-id" value={oauthClientId} autoComplete="off" onChange={(event) => { setOauthClientId(event.target.value); setRotationAcknowledged(false); }} /></label>
            <label className={LABEL}>{signInMethod === "microsoft" ? "Client secret" : t("denInference.editor.oauthClientSecretLabel")} {configuredSet?.hasOauthClientSecret ? t("denInference.editor.configuredSuffix") : ""}<DenInput className={`mt-1.5 ${MONO_INPUT}`} type="password" data-testid="gateway-oauth-client-secret" value={oauthClientSecret} autoComplete="new-password" onChange={(event) => { setOauthClientSecret(event.target.value); setRotationAcknowledged(false); }} placeholder={configuredSet?.hasOauthClientSecret ? t("denInference.editor.savedSecretPlaceholder") : undefined} /></label>
            <Link href={MEMBER_SIGN_IN_DOC_URLS[signInMethod ?? "google"]} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "secondary", size: "sm", className: "mt-3 w-fit" })}>{t("denInference.editor.readSetupInstructions")}</Link>
          </>
        ) : vertex ? (
          <label className={LABEL}>{t("denInference.editor.serviceAccountLabel")}<DenTextarea className={`mt-1.5 ${MONO_INPUT}`} data-testid="gateway-service-account" value={serviceAccountJson} onChange={(event) => setServiceAccountJson(event.target.value)} placeholder={configuredSet?.configured ? t("denInference.editor.savedJsonPlaceholder") : t("denInference.editor.pasteKeyFilePlaceholder")} /></label>
        ) : bedrock ? (
          <>
            {reusableKeyProviders.length ? (
              <div className="mt-3 flex items-center gap-3">
                <span className="min-w-0 flex-1 text-[13px] text-gray-900">{reuseSource ? t("denInference.editor.usingSavedAwsKeys", { name: reuseSource.name }) : t("denInference.editor.useSavedAwsKeys")}</span>
                <DenSwitch checked={reuseSource !== null} aria-label={t("denInference.editor.useSavedAwsKeysLabel")} testId="gateway-aws-reuse-keys"
                  onChange={(checked) => { setReuseKeysFrom(checked ? reusableKeyProviders[0]?.id ?? null : null); setAwsKeys(EMPTY_AWS_KEYS); }} />
              </div>
            ) : null}
            {reuseSource && reusableKeyProviders.length > 1 ? (
              <div className="mt-2 w-[280px]">
                <DenCombobox ariaLabel={t("denInference.editor.savedAwsKeysLabel")} value={reuseSource.id} options={reusableKeyProviders.map((entry) => ({ value: entry.id, label: entry.name }))}
                  placeholder={t("denInference.editor.chooseProviderPlaceholder")} searchPlaceholder={t("denInference.editor.searchProviders")} emptyLabel={t("denInference.editor.noSavedKeys")} onChange={setReuseKeysFrom} />
              </div>
            ) : null}
            {reuseSource ? null : <>
            <label className={LABEL}>{t("denInference.editor.accessKeyIdLabel")}<DenInput className={`mt-1.5 ${MONO_INPUT}`} data-testid="gateway-aws-access-key-id" value={awsKeys.accessKeyId} autoComplete="off" onChange={(event) => setAwsKeys((current) => ({ ...current, accessKeyId: event.target.value }))} placeholder={configuredSet?.configured ? t("denInference.editor.savedAwsKeysPlaceholder") : "AKIA…"} /></label>
            <label className={LABEL}>{t("denInference.editor.secretAccessKeyLabel")}<DenInput className={`mt-1.5 ${MONO_INPUT}`} type="password" data-testid="gateway-aws-secret-access-key" value={awsKeys.secretAccessKey} autoComplete="new-password" onChange={(event) => setAwsKeys((current) => ({ ...current, secretAccessKey: event.target.value }))} /></label>
            <label className={LABEL}>{t("denInference.editor.sessionTokenLabel")}<DenInput className={`mt-1.5 ${MONO_INPUT}`} type="password" data-testid="gateway-aws-session-token" value={awsKeys.sessionToken} autoComplete="new-password" onChange={(event) => setAwsKeys((current) => ({ ...current, sessionToken: event.target.value }))} /></label>
            </>}
          </>
        ) : envNames.length > 1 ? (
          envNames.map((envName) => (
            <label key={envName} className={LABEL}>{envName}<DenInput className={`mt-1.5 ${MONO_INPUT}`} type="password" value={apiKeyValues[envName] ?? ""} onChange={(event) => setApiKeyValues((current) => ({ ...current, [envName]: event.target.value }))} /></label>
          ))
        ) : (
          <label className={LABEL}>
            API key
            <span className="mt-1.5 flex items-center gap-2">
              <span className="min-w-0 flex-1">
                <DenInput className={MONO_INPUT} type={keySaved ? "text" : "password"} data-testid="gateway-provider-api-key" readOnly={keySaved}
                  value={keySaved ? "••••••••••••••••••••••••••••••••" : apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={t("denInference.editor.pasteKeyPlaceholder")} />
              </span>
              {configuredSet?.configured ? (
                <>
                  <DenButton size="sm" variant="secondary" type="button" data-testid="gateway-provider-replace-key" onClick={() => { setReplacingKey((current) => !current); setApiKey(""); }}>{replacingKey ? t("denInference.editor.keepSavedKey") : t("denInference.editor.replaceKey")}</DenButton>
                  <Check className="h-4 w-4 text-emerald-600" aria-label={t("denInference.editor.keySavedLabel")} />
                </>
              ) : null}
            </span>
          </label>
        )}
      </section>

      <section className={`${CARD} mt-3`} aria-labelledby="gateway-access-heading">
        <h2 id="gateway-access-heading" className={CARD_TITLE}>{t("denInference.editor.whoCanUseIt")}</h2>
        <div className="mt-3 flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500"><Globe className="h-4 w-4" aria-hidden="true" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-medium text-gray-900">{t("denInference.editor.everyoneInOrg")}</span>
            <span className="block text-[12px] text-gray-500">{access.allMembers ? t("denInference.editor.allMembersCanUse") : t("denInference.editor.onlyAddedCanUse")}</span>
          </span>
          <DenSwitch checked={access.allMembers} aria-label={t("denInference.editor.everyoneInOrg")} data-testid="gateway-access-all-members"
            onChange={(checked) => setAccess((current) => ({ ...current, allMembers: checked, ...(checked ? { teamIds: [], memberIds: [] } : {}) }))} />
        </div>
        {!access.allMembers ? (
          <ul className="mt-3 divide-y divide-gray-100 border-t border-gray-100">
            {access.teamIds.map((teamId) => {
              const team = teams.find((entry) => entry.id === teamId);
              return (
                <li key={teamId} className="flex items-center gap-3 py-2.5" data-testid="gateway-access-row">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500"><Users className="h-4 w-4" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-gray-900">{team?.name ?? t("denInference.editor.teamFallback")}</span>
                    <span className="block text-[12px] text-gray-500">{team ? t("denInference.editor.teamMemberCountNote", { count: team.memberIds.length }) : teamId}</span>
                  </span>
                  <span className="text-[11px] text-gray-400">{grantMeta({ type: "team", teamId })}</span>
                  <DenButton size="sm" variant="secondary" type="button" disabled={saving} aria-label={t("denInference.editor.removeAccessFor", { name: team?.name ?? t("denInference.editor.teamLowercase") })} onClick={() => setRemovingAccess({ type: "team", id: teamId, name: team?.name ?? t("denInference.editor.thisTeam") })}>{t("denInference.editor.removeAction")}</DenButton>
                </li>
              );
            })}
            {access.memberIds.map((memberId) => {
              const member = members.find((entry) => entry.id === memberId);
              return (
                <li key={memberId} className="flex items-center gap-3 py-2.5" data-testid="gateway-access-row">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500"><User className="h-4 w-4" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-gray-900">{member?.user.name ?? t("denInference.editor.personFallback")}</span>
                    <span className="block text-[12px] text-gray-500">{member?.user.email ?? memberId}</span>
                  </span>
                  <span className="text-[11px] text-gray-400">{grantMeta({ type: "member", memberId })}</span>
                  <DenButton size="sm" variant="secondary" type="button" disabled={saving} aria-label={t("denInference.editor.removeAccessFor", { name: member?.user.name ?? t("denInference.editor.personLowercase") })} onClick={() => setRemovingAccess({ type: "member", id: memberId, name: member?.user.name ?? t("denInference.editor.thisPerson") })}>{t("denInference.editor.removeAction")}</DenButton>
                </li>
              );
            })}
          </ul>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <DenButton size="sm" variant="secondary" icon={Plus} type="button" disabled={saving} data-testid="gateway-access-add-person" onClick={() => setAdding(adding === "person" ? null : "person")}>{t("denInference.editor.addPerson")}</DenButton>
          <DenButton size="sm" variant="secondary" icon={Plus} type="button" disabled={saving} data-testid="gateway-access-add-team" onClick={() => setAdding(adding === "team" ? null : "team")}>{t("denInference.editor.addTeam")}</DenButton>
          {adding ? (
            <div className="w-[280px]">
              <DenCombobox ariaLabel={adding === "team" ? t("denInference.editor.teamFallback") : t("denInference.editor.personFallback")} value="" options={adding === "team" ? teamOptions : memberOptions}
                placeholder={adding === "team" ? t("denInference.editor.chooseTeamPlaceholder") : t("denInference.editor.choosePersonPlaceholder")} searchPlaceholder={adding === "team" ? t("denInference.editor.searchTeams") : t("denInference.editor.searchPeople")} emptyLabel={adding === "team" ? t("denInference.editor.noTeamsToAdd") : t("denInference.editor.noPeopleToAdd")}
                onChange={(id) => {
                  setAccess((current) => ({ ...current, allMembers: false, ...(adding === "team" ? { teamIds: [...current.teamIds, id] } : { memberIds: [...current.memberIds, id] }) }));
                  setAdding(null);
                }} />
            </div>
          ) : null}
        </div>
      </section>

      <ConfirmDialog
        confirm={removingAccess ? {
          title: t("denInference.editor.removeAccessTitle", { name: removingAccess.name }),
          description: t("denInference.editor.removeAccessBody", { subject: removingAccess.type === "team" ? t("denInference.editor.membersOf", { name: removingAccess.name }) : removingAccess.name, provider: displayName }),
          action: t("denInference.editor.removeAccessAction"),
        } : null}
        destructive
        onClose={() => setRemovingAccess(null)}
        onConfirm={() => {
          if (!removingAccess) return;
          const removal = removingAccess;
          setAccess((current) => ({ ...current, ...(removal.type === "team" ? { teamIds: current.teamIds.filter((id) => id !== removal.id) } : { memberIds: current.memberIds.filter((id) => id !== removal.id) }) }));
        }}
      />

      <section className={`${CARD} mt-3`} aria-labelledby="gateway-models-heading" aria-busy={catalogBusy}>
        <h2 id="gateway-models-heading" className={CARD_TITLE}>{t("denInference.editor.modelsHeading")}</h2>
        {catalogError ? <div data-testid="gateway-models-error"><DenNotice tone="error" presentation="inline" message={catalogError} className="mt-3" action={<DenButton size="sm" variant="secondary" data-testid="gateway-models-retry" onClick={() => { setSaveError(null); setCatalogAttempt((current) => current + 1); }}>{t("denInference.editor.retry")}</DenButton>} /></div> : null}
        {!catalogBusy && !catalogError && detail && !models.length ? <div data-testid="gateway-models-empty"><DenNotice tone="neutral" presentation="inline" message={t("denInference.editor.noModelsInCatalog")} className="mt-3" action={<DenButton size="sm" variant="secondary" data-testid="gateway-models-retry" onClick={() => { setSaveError(null); setCatalogAttempt((current) => current + 1); }}>{t("denInference.editor.retry")}</DenButton>} /></div> : null}
        <div className="mt-3 flex gap-2">
          <Radio testId="gateway-models-all" checked={allowAllModels} label={t("denInference.editor.allModelsOf", { name: displayName })} onSelect={() => setAllowAllModels(true)} />
          <Radio testId="gateway-models-pick" checked={!allowAllModels} label={t("denInference.editor.onlyPickedModels")} onSelect={() => { setAllowAllModels(false); if (!provider) setModelIds([]); }} />
        </div>
        {!allowAllModels ? (
          <div className="mt-3 rounded-[10px] bg-gray-50 p-2">
            <div className="flex items-center gap-3">
              <div className="w-[200px]"><DenInput type="search" icon={Search} value={modelQuery} onChange={(event) => setModelQuery(event.target.value)} placeholder={t("denInference.editor.filterModelsPlaceholder")} className="h-8 bg-white text-[12px]" /></div>
              {!catalogBusy && !catalogError ? <span className="text-[12px] text-gray-500" data-testid="gateway-models-count">{t("denInference.editor.selectedCount", { selected: modelIds.length, total: models.length })}</span> : null}
              <span className="ml-auto flex items-center gap-3 text-[12px]">
                <button type="button" data-testid="gateway-models-select-all" disabled={catalogBusy || Boolean(catalogError) || !models.length} className="font-medium text-gray-700 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => setModelIds(models.map((model) => model.id))}>{t("denInference.editor.selectAll")}</button>
                <button type="button" data-testid="gateway-models-clear" disabled={catalogBusy || Boolean(catalogError) || !models.length} className="font-medium text-gray-700 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => setModelIds([])}>{t("denInference.editor.clear")}</button>
              </span>
            </div>
            <ul className="mt-2 max-h-[320px] overflow-y-auto">
              {filteredModels.map((model) => {
                const checked = modelIds.includes(model.id);
                return (
                  <li key={model.id}>
                    <label className="flex items-center gap-3 rounded-[8px] px-2 py-1.5 hover:bg-white">
                      <input type="checkbox" checked={checked} onChange={() => setModelIds((current) => checked ? current.filter((id) => id !== model.id) : [...current, model.id])} className="h-4 w-4 accent-emerald-600" data-testid={`gateway-model-${model.id}`} />
                      <DenBrandMark name={displayName} simpleIconSlug={getProviderIconSlug(providerId)} serviceUrl={detail?.doc ?? null} className="h-5 w-5 rounded-[5px]" imageClassName="h-3 w-3" />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-gray-900">{model.name}</span>
                      <span className="text-[11px] text-gray-400">{displayName}</span>
                    </label>
                  </li>
                );
              })}
              {catalogBusy ? Array.from({ length: 4 }, (_, index) => <li key={index} className="flex items-center gap-3 px-2 py-1.5" data-testid="gateway-models-loading"><DenSkeleton className="size-4" /><DenSkeleton className="size-5 rounded" /><DenSkeleton className="h-4 flex-1" /><DenSkeleton className="h-3 w-20" /></li>) : null}
              {!catalogBusy && !catalogError && models.length > 0 && !filteredModels.length ? <li className="px-2 py-3 text-[12px] text-gray-500" data-testid="gateway-models-filter-empty">{t("denInference.editor.noModelsMatch")}</li> : null}
            </ul>
          </div>
        ) : null}
      </section>

      <DenStickyActionBar summary={<span>{allowAllModels ? t("denInference.editor.allModelsOf", { name: displayName }) : t("denInference.editor.modelsCountLabel", { count: modelIds.length })} · {access.allMembers ? t("denInference.editor.everyoneSummary") : t("denInference.editor.teamsOrPeopleCount", { count: access.teamIds.length + access.memberIds.length })}{provider?.updatedAt ? t("denInference.editor.savedAt", { date: formatProviderTimestamp(provider.updatedAt) }) : ""}</span>}>
        {provider ? (
          <AlertDialog.Root open={confirmDelete && !reauthDialogOpen} onOpenChange={(open) => { if (saving) return; setConfirmDelete(open); if (open) setSaveError(null); }}>
            <AlertDialog.Trigger disabled={saving} className={buttonVariants({ variant: "secondary" })} data-testid="gateway-provider-remove">{t("denInference.editor.removeAction")}</AlertDialog.Trigger>
            <AlertDialog.Portal>
              <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-gray-950/45" />
              <AlertDialog.Popup initialFocus={cancelDeleteRef} aria-busy={saving} className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[16px] border border-gray-200 bg-white p-5 outline-none">
                <AlertDialog.Title className="text-[15px] font-medium text-gray-950">{t("denInference.editor.removeProviderTitle", { name: provider.name })}</AlertDialog.Title>
                <AlertDialog.Description className="mt-2 text-[13px] leading-5 text-gray-600">{t("denInference.editor.removeProviderBody")}</AlertDialog.Description>
                {saveError ? <DenNotice className="mt-4" tone="error" message={saveError} /> : null}
                <div className="mt-5 flex justify-end gap-2">
                  <AlertDialog.Close ref={cancelDeleteRef} disabled={saving} className={buttonVariants({ variant: "secondary" })}>Cancel</AlertDialog.Close>
                  <DenButton variant="destructive" loading={saving} onClick={() => void remove()}>{t("denInference.editor.removeProviderAction")}</DenButton>
                </div>
              </AlertDialog.Popup>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        ) : (
          <Link href={getAiGatewayProvidersRoute(orgSlug)} className={buttonVariants({ variant: "secondary" })}>Cancel</Link>
        )}
        <DenButton data-testid="gateway-provider-save" loading={saving} onClick={() => void save()}>{provider ? "Save changes" : t("denInference.editor.addProviderNamed", { name: displayName })}</DenButton>
      </DenStickyActionBar>
    </div>
  );
}
