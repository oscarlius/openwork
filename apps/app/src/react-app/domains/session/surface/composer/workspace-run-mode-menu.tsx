import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Hand, LoaderCircle, ShieldAlert, ShieldCheck } from "lucide-react";
import type { OpenworkServerClient, WorkspaceRunMode } from "@/app/lib/openwork-server";
import { isDesktopRuntime } from "@/app/lib/runtime-env";
import { t } from "@/i18n";
import { toast } from "@/components/ui/sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useDesktopRestriction } from "@/react-app/domains/cloud/desktop-config-provider";
import { useFeatureFlagsPreferences } from "@/react-app/domains/settings/state/feature-flags-preferences";

type Props = { client: OpenworkServerClient | null; workspaceId: string | null; busy: boolean };

function modeOptions() {
  return [
    { value: "approve", label: t("run_mode.ask_label"), description: t("run_mode.ask_desc"), icon: Hand },
    { value: "default", label: t("run_mode.default_label"), description: t("run_mode.default_desc"), icon: ShieldCheck },
    { value: "run-everything", label: t("run_mode.everything_label"), description: t("run_mode.everything_desc"), icon: ShieldAlert },
  ] satisfies { value: WorkspaceRunMode; label: string; description: string; icon: typeof Hand }[];
}

export function WorkspaceRunModeMenu(props: Props) {
  const { workspaceRunModeEnabled } = useFeatureFlagsPreferences();
  const restricted = useDesktopRestriction("allowControlSettings");
  if (!workspaceRunModeEnabled || restricted || !isDesktopRuntime() || !props.client || !props.workspaceId) return null;
  // Remount on endpoint/workspace changes so a pending confirmation cannot
  // apply the previous pane's choice to a newly selected workspace.
  return <WorkspaceRunModePicker key={`${props.client.baseUrl}:${props.workspaceId}`} client={props.client} workspaceId={props.workspaceId} busy={props.busy} />;
}

function WorkspaceRunModePicker({ client, workspaceId, busy }: { client: OpenworkServerClient; workspaceId: string; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const queryClient = useQueryClient();
  const queryKey = ["workspace-run-mode", client.baseUrl, workspaceId];
  const mode = useQuery({ queryKey, queryFn: () => client.getWorkspaceRunMode(workspaceId), retry: false });
  const mutation = useMutation({
    mutationKey: queryKey,
    mutationFn: (value: WorkspaceRunMode) => client.setWorkspaceRunMode(workspaceId, value),
    onSuccess: (result) => {
      queryClient.setQueryData(queryKey, result);
      setConfirm(false);
      setOpen(false);
      if (result.refreshPending) toast.warning(result.reason ?? t("run_mode.saved_reload_hint"));
      else toast.success(t("run_mode.updated"));
    },
    onError: (error: Error) => {
      toast.error(error.message);
      void mode.refetch();
    },
  });
  const modes = modeOptions();
  const selected = modes.find((item) => item.value === mode.data?.mode);
  const label = mode.isError ? t("config.unavailable") : selected?.label ?? (mode.isPending ? t("settings.loading") : t("run_mode.custom_rules"));
  const triggerLabel = mode.data?.refreshPending ? t("run_mode.trigger_label_pending", { label }) : t("run_mode.trigger_label", { label });
  const Icon = mode.data?.supported === false || mode.isError || mode.data?.refreshPending ? ShieldAlert : selected?.icon ?? ShieldCheck;
  const locked = busy || mutation.isPending || mode.isFetching || !mode.data?.supported;
  const select = (value: unknown) => {
    if (locked || (value !== "default" && value !== "approve" && value !== "run-everything")) return;
    if (value === "run-everything") {
      setOpen(false);
      setConfirm(true);
    } else mutation.mutate(value);
  };
  return (
    <>
      <DropdownMenu open={open} onOpenChange={(next) => { setOpen(next); if (next) void mode.refetch(); }}>
        <DropdownMenuTrigger
          data-testid="workspace-run-mode-trigger"
          aria-label={triggerLabel}
          title={triggerLabel}
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-gray-3 ${mode.data?.mode === "run-everything" || mode.data?.refreshPending ? "text-orange-600 dark:text-orange-400" : "text-gray-10"}`}
        >
          {mutation.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Icon className="size-4" />}
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" sideOffset={10} className="w-[min(390px,calc(100vw-32px))] p-2">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-3 text-sm">{t("run_mode.heading")}</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={mode.data?.mode ?? ""}>
              {modes.map((item) => (
                <DropdownMenuRadioItem key={item.value} value={item.value} onClick={() => select(item.value)} aria-label={item.label} data-testid={`run-mode-${item.value}`} disabled={locked} className={`gap-3 py-3 ${item.value === "run-everything" ? "text-orange-600 dark:text-orange-400" : ""}`}>
                  <item.icon className="size-5" />
                  <span className="min-w-0">
                    <span className="block">{item.label}</span>
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{item.description}</span>
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <p className="px-3 py-2 text-xs text-muted-foreground">{t("run_mode.scope_note")}</p>
          {busy ? <p role="status" className="px-3 pb-2 text-xs text-muted-foreground">{t("run_mode.busy_wait")}</p> : null}
          {mode.isError ? <p role="alert" className="px-3 pb-2 text-xs text-destructive">{t("run_mode.unavailable_error")} {mode.error.message}</p> : null}
          {mode.data?.reason ? <p role="status" className="px-3 pb-2 text-xs text-muted-foreground">{mode.data.reason}</p> : null}
          {mode.data?.refreshPending ? <p role="status" className="px-3 pb-2 text-xs text-orange-600">{t("run_mode.refresh_pending_hint")}</p> : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("run_mode.confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("run_mode.confirm_desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={locked} onClick={() => mutation.mutate("run-everything")}>{t("run_mode.enable_action")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
