import { useState } from "react";
import { useNavigate } from "react-router";
import { AppActionsMenu, getAppUpdatePrompt } from "./app-actions-menu";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useAppsClient } from "./use-apps";
import type { DashboardLaunchEndpoint } from "../dashboard/mcp-app-tile";
import { loadSavedAppForDisplay, viewerLocalDate } from "./live-generated-app-model";
import { LiveGeneratedApp, isLiveGeneratedApp, useViewerDay } from "./live-generated-app";
import { GeneratedAppPreview } from "./generated-app-preview";
import { DashboardConnectionCard } from "../dashboard/dashboard-connection-card";
import { connectionCardPayloadFromChatToolResult } from "@/components/tools/error-attribution";
import { t } from "@/i18n";

export type AppReference = { appId: string; revisionId?: string; receiptId?: string };

export function AppArtifact({ appId, revisionId, receiptId, onClose, onAsk, fallbackEndpoints }: AppReference & { fallbackEndpoints?: DashboardLaunchEndpoint[]; onClose?: () => void; onAsk?: (prompt: string) => Promise<void> }) {
  const { client, orgId, scope, canManage } = useAppsClient();
  const navigate = useNavigate();
  const { timeZone, now } = useViewerDay();
  const cache = useQueryClient();
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [useInWorkflow, setUseInWorkflow] = useState(true);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const ask = async (prompt: string) => {
    if (!onAsk || asking) return;
    setAsking(true); setAskError(null);
    try { await onAsk(prompt); }
    catch (cause) { setAskError(cause instanceof Error ? cause.message : t("app.error_conversation_open")); }
    finally { setAsking(false); }
  };
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["app-preview", ...scope, appId, revisionId, receiptId, timeZone, viewerLocalDate(timeZone, now)],
    enabled: Boolean(client && orgId),
    queryFn: () => {
      if (!client || !orgId) throw new Error(t("app.sign_in_to_open_artifact"));
      return loadSavedAppForDisplay(client, orgId, appId, { revisionId, receiptId, timeZone });
    },
  });
  const app = query.isError ? undefined : query.data;
  const toolName = `openwork-cloud_run_artifact_${appId}`;
  const connectionOutput = app?.runError?.connectionCard;
  const connection = connectionCardPayloadFromChatToolResult(toolName, connectionOutput);
  const updatePrompt = canManage ? getAppUpdatePrompt(app) : undefined;
  const onUpdate = onAsk && updatePrompt ? () => void ask(updatePrompt) : undefined;
  const revision = app?.revision;
  const saved = Boolean(revision && app?.view.activeRevisionId === revision.id);
  const save = useMutation({
    mutationFn: async () => {
      if (!canManage || !app?.canManage) throw new Error(t("app.manage_only_org_admins"));
      if (!client || !orgId || !app || !revision) throw new Error(t("app.artifact_not_ready_to_save"));
      return client.saveApp(orgId, appId, { revisionId: revision.id, title: name.trim(), useInWorkflow, expectedActiveRevisionId: app.view.activeRevisionId });
    },
    onSuccess: async (view) => {
      setSaveOpen(false);
      setConfirmation(view.useInWorkflow
        ? t("app.saved_to_dashboard_ready")
        : t("app.saved_to_dashboard_open"));
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["app-preview", ...scope, appId] }),
        cache.invalidateQueries({ queryKey: ["saved-apps", ...scope] }),
      ]);
    },
  });
  if (!client || !orgId) return <p className="p-6 text-sm text-muted-foreground">{t("app.sign_in_to_open_artifact")}</p>;
  if (query.isPending) return <p className="flex items-center gap-2 p-6 text-sm" role="status"><Loader2 className="size-4 animate-spin" />{t("app.preparing_preview")}</p>;
  if (!app) return <div className="space-y-3 p-6"><p role="alert" className="text-sm">{query.error instanceof Error ? query.error.message : t("app.artifact_could_not_open")}</p><Button variant="outline" onClick={() => void query.refetch()}>{t("engine_migration.try_again")}</Button></div>;
  return <section className="flex h-full min-h-0 flex-col bg-background" aria-label={t("app.section_aria", { title: app.view.title })}>
    <header className="flex items-center gap-2 border-b px-4 py-3" data-app-header>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-sm font-medium" title={app.view.title}>{app.view.title}</h2>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
          {saved ? <><Check className="size-3 shrink-0" />{t("app.status_saved_artifact")}</> : app.view.activeRevisionId ? t("app.status_unsaved_changes") : t("app.status_draft")}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {canManage && app.canManage && !saved ? <Button size="sm" disabled={!revision || revision.buildStatus !== "ready"} onClick={() => {
          setName(app.view.title); setUseInWorkflow(app.view.activeRevisionId ? app.view.useInWorkflow !== false : true); setSaveOpen(true); save.reset();
        }}>{app.view.activeRevisionId ? t("automations.save_changes") : t("common.save")}</Button> : null}
        <AppActionsMenu appId={appId} title={app.view.title} canManage={app.canManage} canDelete={app.canManage && app.view.status !== "retired"}
          busy={asking} onUpdate={onUpdate} onDeleted={onClose ?? (() => navigate("/dashboard"))}
          onRun={onAsk && saved ? () => void ask(`Run my saved app “${app.view.title}” with fresh data and show the new results in the saved app.`) : undefined}
          onEdit={onAsk ? () => void ask(`Help me improve my saved app “${app.view.title}”. Read its existing app source, ask what I want to change, and show a draft preview for me to save.`) : undefined} />
        {onClose ? <Button variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={onClose} aria-label={t("app.close_artifact_aria")}><X className="size-4" /></Button> : null}
      </div>
    </header>
    <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
      {askError ? <p role="alert" className="text-sm text-destructive">{askError}</p> : null}
      {confirmation ? <p role="status" className="rounded-lg bg-muted p-3 text-sm">{confirmation}</p> : null}
      <p className="text-xs text-muted-foreground">{saved && isLiveGeneratedApp(app.view) ? t("app.live_results_hint") : saved ? t("app.saved_results_hint") : t("app.preview_results_hint")}</p>
      {connection ? <DashboardConnectionCard toolName={toolName} toolCallId={`preview-${appId}-${revisionId ?? "active"}`} output={connectionOutput}
        onConnected={() => { void query.refetch(); }} /> : app.runError ? <div className="space-y-3"><p role="alert" className="text-sm">{app.previewNotice || t("app.preview_run_failed")}</p><Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>{t("engine_migration.try_again")}</Button></div> : saved && isLiveGeneratedApp(app.view) && revision ? <LiveGeneratedApp view={app.view} revision={revision} fallbackEndpoints={fallbackEndpoints} /> : app.html && app.payload && revision ? <GeneratedAppPreview html={app.html} payload={app.payload} title={app.view.title} revision={revision} /> : <div className="flex flex-wrap items-center gap-3">
        <p role="status" className="text-sm text-muted-foreground">{app.previewNotice}</p>
        {onUpdate ? <Button variant="outline" size="sm" disabled={asking} onClick={onUpdate}>{asking ? t("dashboard.opening_conversation") : t("app.update_artifact")}</Button> : null}
      </div>}
      {canManage && app.canManage && !saved ? <p className="text-xs text-muted-foreground">{t("app.draft_kept_hint")}</p> : null}
    </div>
    <Dialog open={canManage && app.canManage && saveOpen} onOpenChange={(open) => { if (!save.isPending) setSaveOpen(open); }}>
      <DialogContent>
        <form onSubmit={(event) => { event.preventDefault(); if (name.trim() && !save.isPending) save.mutate(); }}>
          <DialogHeader><DialogTitle>{app.view.activeRevisionId ? t("automations.save_changes") : t("app.save_to_dashboard_title")}</DialogTitle><DialogDescription>{t("app.save_dialog_desc")}</DialogDescription></DialogHeader>
          <div className="space-y-5 py-5">
            <div className="space-y-2"><Label htmlFor={`app-name-${appId}`}>{t("app.artifact_name_label")}</Label><Input id={`app-name-${appId}`} value={name} onChange={(event) => setName(event.target.value)} maxLength={255} required autoFocus disabled={save.isPending} /><p className="text-xs text-muted-foreground">{t("app.save_location_hint")}</p></div>
            <label className="flex items-start gap-3"><Checkbox checked={useInWorkflow} onCheckedChange={(checked) => setUseInWorkflow(checked === true)} disabled={save.isPending} /><span className="text-sm">{t("app.use_view_for_results")}<span className="mt-1 block text-xs text-muted-foreground">{t("app.use_view_for_results_desc")}</span></span></label>
            {app.view.activeRevisionId ? <p className="text-xs text-muted-foreground">{t("app.open_results_keep_version")}</p> : null}
            {save.error ? <p role="alert" className="text-sm text-destructive">{save.error instanceof Error ? save.error.message : t("app.save_failed")}</p> : null}
          </div>
          <DialogFooter><Button type="button" variant="outline" disabled={save.isPending} onClick={() => setSaveOpen(false)}>{t("common.cancel")}</Button><Button type="submit" disabled={!name.trim() || save.isPending}>{save.isPending ? t("settings.environment.saving") : app.view.activeRevisionId ? t("automations.save_changes") : t("common.save")}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </section>;
}
