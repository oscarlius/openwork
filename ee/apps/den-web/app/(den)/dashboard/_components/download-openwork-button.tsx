"use client";

import { Popover } from "@base-ui/react/popover";
import { Copy, Download, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { DenButton } from "../../_components/ui/button";
import { createOrganizationInstallLink } from "../../_lib/install-link-data";
import { useDenT } from "../../../_lib/i18n/client";

export function DownloadOpenWorkButton({
  organization,
}: {
  organization?: { id: string; name: string };
}) {
  const t = useDenT();
  if (organization) {
    return <OrganizationDownloadPopover organizationId={organization.id} organizationName={organization.name} />;
  }

  return (
    <DenButton
      href="/install"
      size="sm"
      icon={Download}
      aria-label={t("denSetup.install.cloudTitle")}
      data-testid="den-download-openwork"
      className="shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
    >
      <span className="hidden sm:inline">{t("denSetup.install.cloudTitle")}</span>
    </DenButton>
  );
}

function OrganizationDownloadPopover({
  organizationId,
  organizationName,
}: {
  organizationId: string;
  organizationName: string;
}) {
  const [busyAction, setBusyAction] = useState<"open" | "copy" | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useDenT();

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function mintInstallLink() {
    return createOrganizationInstallLink(organizationId, false);
  }

  async function handleOpenInstallPage() {
    setError(null);
    // Open during the click, before minting, so browser popup blockers keep
    // recognizing this as the person's action even on a slow connection.
    const installWindow = window.open("about:blank", "_blank");
    if (!installWindow) {
      setError(t("denSetup.download.popupsBlocked"));
      return;
    }
    installWindow.opener = null;
    setBusyAction("open");
    try {
      installWindow.location.replace(await mintInstallLink());
    } catch (downloadError) {
      installWindow.close();
      setError(downloadError instanceof Error ? downloadError.message : t("denSetup.download.openFailed"));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCopyInstallLink() {
    setBusyAction("copy");
    setError(null);
    setCopied(false);
    try {
      const installLink = await mintInstallLink();
      try {
        await navigator.clipboard.writeText(installLink);
        setCopied(true);
      } catch {
        setError(t("denSetup.download.clipboardBlocked"));
      }
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : t("denSetup.download.createLinkFailed"));
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <Popover.Root>
      <Popover.Trigger
        render={<DenButton size="sm" icon={Download} />}
        aria-label={t("denSetup.install.cloudTitle")}
        data-testid="den-download-openwork"
        className="shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
      >
        <span className="hidden sm:inline">{t("denSetup.install.cloudTitle")}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
          <Popover.Popup
            className="w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white p-4 text-gray-900"
            data-testid="workspace-install-popover"
          >
            <Popover.Title className="text-[13px] font-semibold">{t("denSetup.download.popoverTitle")}</Popover.Title>
            <Popover.Description className="mt-1 text-[13px] text-gray-500">
              {t("denSetup.download.popoverDescription", { organizationName })}
            </Popover.Description>
            {error ? (
              <p className="mt-3 text-[13px] text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            <div className="mt-4 flex flex-col gap-2">
              <DenButton
                className="w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
                data-testid="workspace-install-open"
                icon={ExternalLink}
                loading={busyAction === "open"}
                disabled={busyAction !== null}
                onClick={() => void handleOpenInstallPage()}
              >
                {t("denSetup.download.openInstallPage")}
              </DenButton>
              <DenButton
                className="w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
                data-testid="workspace-install-copy"
                icon={Copy}
                variant="secondary"
                loading={busyAction === "copy"}
                disabled={busyAction !== null}
                onClick={() => void handleCopyInstallLink()}
              >
                {copied ? t("denSetup.install.copied") : t("denSetup.install.copyInstallLink")}
              </DenButton>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
