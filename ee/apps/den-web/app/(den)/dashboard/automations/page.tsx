import { Suspense } from "react";
import { createDenT } from "../../../_lib/i18n/messages";
import { resolveDenLocale } from "../../../_lib/i18n/server";
import { AutomationsScreen } from "../_components/automations-screen";

export default async function AutomationsPage() {
  const t = createDenT(await resolveDenLocale());
  return (
    <Suspense fallback={<div className="mx-auto max-w-[980px] px-6 py-8 text-[13px] text-gray-400">{t("denWorkflow.automation.listLoading")}</div>}>
      <AutomationsScreen />
    </Suspense>
  );
}
