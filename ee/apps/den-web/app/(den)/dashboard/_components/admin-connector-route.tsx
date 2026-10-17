"use client";

import { getAddConnectorRoute, getMcpConnectionsRoute } from "../../_lib/den-org";
import { useDenT } from "../../../_lib/i18n/client";
import { useOrgDashboard } from "../_providers/org-dashboard-provider";
import { AdminConnectorPageScreen } from "./admin-connector-page-screen";
import { ItemHeader, ItemPage } from "./item-header";
import { LinkButton } from "./item-list";
import { useMcpConnections } from "./mcp-connections-data";

/** A configured connector's Manage page, Google Workspace and Microsoft 365 included. */
export function AdminConnectorRoute({ connectorId }: { connectorId: string }) {
  const t = useDenT();
  const { orgSlug } = useOrgDashboard();
  const connections = useMcpConnections("manageable");
  const usable = useMcpConnections("usable");
  const connection = connections.data?.find((entry) => entry.id === connectorId)
    ?? usable.data?.find((entry) => entry.id === connectorId);
  if (connection) return <AdminConnectorPageScreen connection={connection} />;
  const back = { href: getMcpConnectionsRoute(orgSlug), label: "Connectors" };
  if (connections.isLoading || usable.isLoading) return <ItemPage><ItemHeader back={back} title="Loading..." /></ItemPage>;
  return (
    <ItemPage testId="connector-not-found">
      <ItemHeader
        back={back}
        title={t("denConnector.page.notFoundTitle")}
        description={t("denConnector.page.maybeRemoved")}
        actions={<LinkButton variant="primary" href={getAddConnectorRoute(orgSlug)}>{t("denConnector.action.addConnector")}</LinkButton>}
      />
    </ItemPage>
  );
}
