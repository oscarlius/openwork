import { useDenT } from "../../_lib/i18n/client";
import { shouldShowTemporaryAuthNotice } from "../_lib/temporary-auth-notice";
import { DenNotice } from "./ui/notice";

export function TemporaryAuthNotice() {
  const t = useDenT();
  if (!shouldShowTemporaryAuthNotice()) return null;

  return (
    <DenNotice
      tone="warning"
      className="leading-5"
      message={(
        <span className="grid gap-2">
          <span>
            <strong className="font-semibold">{t("denAuth.temporaryNotice.trouble")}</strong>
            {t("denAuth.temporaryNotice.middle")}
            <strong className="font-semibold">openworklabs.com</strong>
            {t("denAuth.temporaryNotice.tail")}
          </span>
          <span className="grid gap-1 text-[13px]">
            <span><strong className="font-semibold">{t("denAuth.temporaryNotice.chromeLead")}</strong>{t("denAuth.temporaryNotice.chromeBody")}</span>
            <span><strong className="font-semibold">{t("denAuth.temporaryNotice.safariLead")}</strong>{t("denAuth.temporaryNotice.safariBody")}</span>
            <span><strong className="font-semibold">{t("denAuth.temporaryNotice.firefoxLead")}</strong>{t("denAuth.temporaryNotice.firefoxBody")}</span>
          </span>
        </span>
      )}
    />
  );
}
