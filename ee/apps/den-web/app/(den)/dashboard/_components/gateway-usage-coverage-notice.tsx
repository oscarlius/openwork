import { ChevronDown } from "lucide-react";
import type { GatewayUsageResponse } from "@openwork/types/den/gateway-usage";
import { useDenLocale, useDenT } from "../../../_lib/i18n/client";
import { formatDenCount } from "../../../_lib/i18n/den-format";
import type { DenMessageKey } from "../../../_lib/i18n/messages";

const docsUrl = "https://openworklabs.com/docs/ai-gateway/counting-usage#uncountable-items";

// Labels live in the message tables, not here: this table maps the API's stable
// outcome codes (never translated) to the key that renders them.
const categories: {
  outcome: keyof NonNullable<GatewayUsageResponse["usage"]["uncountableRequests"]>;
  labelKey: DenMessageKey;
}[] = [
  { outcome: "upstream_error", labelKey: "denGateway.coverageNotice.categoryUpstreamError" },
  { outcome: "upstream_unreachable", labelKey: "denGateway.coverageNotice.categoryUpstreamUnreachable" },
  { outcome: "client_aborted", labelKey: "denGateway.coverageNotice.categoryClientAborted" },
  { outcome: "rejected", labelKey: "denGateway.coverageNotice.categoryRejected" },
  { outcome: "ok", labelKey: "denGateway.coverageNotice.categoryOk" },
];

export function GatewayUsageCoverageNotice({ usage }: { usage: GatewayUsageResponse["usage"] }) {
  // Hooks run before the early return, so the order stays stable across renders.
  const t = useDenT();
  const locale = useDenLocale();

  if (usage.unreportedRequests === 0) return null;
  const counts = usage.uncountableRequests;

  return <div className="mt-5 text-xs leading-5 text-gray-500">
    <p>{t("denGateway.coverageNotice.prefix")}<a href={docsUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-gray-900">{t("denGateway.coverageNotice.link")}</a>{t("denGateway.coverageNotice.suffix")}</p>
    <details className="group mt-1">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
        {t("denGateway.coverageNotice.details")}
      </summary>
      <div className="mt-2 max-w-sm pl-5">
        {counts ? <dl className="space-y-1">
          {categories.map(({ outcome, labelKey }) => {
            const count = counts[outcome];
            return <div key={outcome} className="flex items-baseline justify-between gap-4">
              <dt>{t(labelKey)}</dt>
              <dd className="tabular-nums">{count === null ? t("denGateway.coverageNotice.countUnavailable") : formatDenCount(locale, count)}</dd>
            </div>;
          })}
        </dl> : null}
        {!counts || Object.values(counts).some((count) => count === null)
          ? <p className="mt-2">{t("denGateway.coverageNotice.breakdownNote")}{usage.unreportedRequests !== null ? t("denGateway.coverageNotice.totalSuffix", { count: formatDenCount(locale, usage.unreportedRequests) }) : t("denGateway.coverageNotice.totalUnavailableSuffix")}</p> : null}
        {usage.groupBy === "team" ? <p className="mt-2">{t("denGateway.coverageNotice.teamMembershipNote")}</p> : null}
      </div>
    </details>
  </div>;
}
