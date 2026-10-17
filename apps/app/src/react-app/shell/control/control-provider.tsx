/** @jsxImportSource react */
import {
  createContext,
  useCallback,
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router";
import {
  openworkAffordanceFailureCodeSchema,
  type OpenworkAffordanceDescriptor,
  type OpenworkAffordanceEffects,
  type OpenworkAffordanceFailureCode,
  type OpenworkAffordanceOrigin,
  type OpenworkAffordanceRequest,
  type OpenworkAffordanceResult,
} from "@openwork/types/openwork-affordance";
import type { OpenworkContextSnapshot } from "@openwork/types/openwork-context";
import { currentLocale, t } from "@/i18n";
import { useUiControlMailbox } from "./use-ui-control-mailbox";

export type OpenworkControlSideEffect = "none" | "navigation" | "mutation" | "external";

export type OpenworkControlActionArg = {
  name: string;
  type?: "string" | "number" | "boolean" | "object" | "array" | "unknown";
  required?: boolean;
  description?: string;
};

export type OpenworkControlActionMetadata = {
  id: string;
  label: string;
  description?: string;
  kind: "query" | "command";
  effects: OpenworkAffordanceEffects;
  sideEffect: OpenworkControlSideEffect;
  requiresConfirmation: boolean;
  requiresArgs: boolean;
  hasPreviewArgs: boolean;
  previewArgs?: unknown;
  args?: OpenworkControlActionArg[];
  disabled: boolean;
  busy: boolean;
};

export type OpenworkControlSnapshot = {
  version: number;
  enabled: boolean;
  route: string;
  status: "off" | "ready" | "acting";
  busyActionId: string | null;
  narration: string;
  actions: OpenworkControlActionMetadata[];
};

export type OpenworkControlResult =
  | { ok: true; actionId: string; result?: unknown }
  | { ok: false; actionId: string; error: string; code?: OpenworkAffordanceFailureCode; hint?: string };

export type OpenworkControlHelpers = {
  setNarration: (text: string) => void;
  /** The conversation whose agent issued the request, when it came through the agent bridge. */
  origin?: OpenworkAffordanceOrigin;
  /**
   * True when an agent issued the command through the server bridge, which
   * answers within seconds and has no person on the other end. A warning for
   * that request goes back through the agent's own conversation as a
   * structured result, never through a dialog.
   */
  bridged: boolean;
};

export type OpenworkControlTargetRef = {
  readonly current: HTMLElement | null;
};

export type OpenworkControlAction = {
  id: string;
  label: string;
  description?: string;
  kind?: "query" | "command";
  effects?: OpenworkAffordanceEffects;
  sideEffect?: OpenworkControlSideEffect;
  requiresConfirmation?: boolean;
  requiresArgs?: boolean;
  args?: OpenworkControlActionArg[];
  previewArgs?: unknown;
  disabled?: boolean;
  targetRef?: OpenworkControlTargetRef;
  execute: (args: unknown, helpers: OpenworkControlHelpers) => unknown | Promise<unknown>;
};

type ControlActionRef = {
  readonly current: OpenworkControlAction | null;
};

type RegisteredAction = {
  id: string;
  order: number;
  token: symbol;
  ref: ControlActionRef;
};

type SpotlightState = {
  visible: boolean;
  phase: "target" | "press";
  rect: { x: number; y: number; width: number; height: number } | null;
};

type OpenworkControlContextValue = {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  route: string;
  narration: string;
  busyActionId: string | null;
  actions: OpenworkControlActionMetadata[];
  registerAction: (actionId: string, actionRef: ControlActionRef) => () => void;
  executeAction: (actionId: string, args?: unknown, origin?: OpenworkAffordanceOrigin) => Promise<OpenworkControlResult>;
  publishContext: (context: OpenworkContextSnapshot) => void;
  snapshot: () => OpenworkControlSnapshot;
};

export type OpenworkControlAPI = {
  version: number;
  snapshot: () => OpenworkControlSnapshot;
  listActions: () => OpenworkControlActionMetadata[];
  execute: (actionId: string, args?: unknown) => Promise<OpenworkControlResult>;
  context: () => OpenworkContextSnapshot;
  query: (request: OpenworkAffordanceRequest) => Promise<OpenworkAffordanceResult>;
  command: (request: OpenworkAffordanceRequest) => Promise<OpenworkAffordanceResult>;
  setEnabled: (enabled: boolean) => void;
  subscribe: (listener: (snapshot: OpenworkControlSnapshot) => void) => () => void;
};

declare global {
  interface Window {
    __openworkControl?: OpenworkControlAPI;
  }
}

const CONTROL_API_VERSION = 2;
const OpenworkControlContext = createContext<OpenworkControlContextValue | null>(null);
const SPOTLIGHT_TIMING_MS = Object.freeze({
  missingTarget: 80,
  scrollIntoView: 180,
  target: 260,
  press: 130,
  release: 80,
  done: 280,
});

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function describeError(error: unknown) {
  return error instanceof Error ? error.message : String(error || t("app.unknown_error"));
}

function returnedActionError(result: unknown) {
  if (!result || typeof result !== "object") return null;
  const payload: { ok?: unknown; error?: unknown; code?: unknown; hint?: unknown } = result;
  if (payload.ok !== false) return null;
  const code = openworkAffordanceFailureCodeSchema.safeParse(payload.code);
  return {
    error: typeof payload.error === "string" && payload.error.trim()
      ? payload.error
      : t("status.action_returned_error"),
    ...(code.success ? { code: code.data } : {}),
    ...(typeof payload.hint === "string" && payload.hint.trim() ? { hint: payload.hint } : {}),
  };
}

function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function effectsForSideEffect(sideEffect: OpenworkControlSideEffect): OpenworkAffordanceEffects {
  if (sideEffect === "navigation") {
    return { data: "none", ui: "navigate", external: false };
  }
  if (sideEffect === "mutation") {
    return { data: "write", ui: "none", external: false };
  }
  if (sideEffect === "external") {
    return { data: "none", ui: "none", external: true };
  }
  return { data: "none", ui: "none", external: false };
}

function metadataForAction(registered: RegisteredAction, busyActionId: string | null): OpenworkControlActionMetadata {
  const action = registered.ref.current;
  const sideEffect = action?.sideEffect ?? "none";
  return {
    id: registered.id,
    label: action?.label ?? registered.id,
    description: action?.description,
    kind: action?.kind ?? "command",
    effects: action?.effects ?? effectsForSideEffect(sideEffect),
    sideEffect,
    requiresConfirmation: action?.requiresConfirmation === true,
    requiresArgs: action?.requiresArgs === true,
    hasPreviewArgs: action?.previewArgs !== undefined,
    previewArgs: action?.previewArgs,
    args: action?.args,
    disabled: action?.disabled === true,
    busy: busyActionId === registered.id,
  };
}

function affordanceForAction(action: OpenworkControlActionMetadata): OpenworkAffordanceDescriptor {
  return {
    id: action.id,
    kind: action.kind,
    title: action.label,
    description: action.description ?? action.label,
    provider: { id: "openwork-ui", kind: "builtin" },
    arguments: (action.args ?? []).map((argument) => ({
      name: argument.name,
      type: argument.type ?? "unknown",
      required: argument.required === true,
      ...(argument.description ? { description: argument.description } : {}),
    })),
    effects: action.effects,
    confirmation: action.requiresConfirmation ? "destructive" : "never",
    availability: {
      enabled: !action.disabled && !action.busy,
      ...(action.disabled ? { reason: t("status.action_unavailable_state") } : {}),
    },
    executor: { kind: "openwork" },
  };
}

function ControlModeSpotlight({ spotlight }: { spotlight: SpotlightState }) {
  const rect = spotlight.rect;
  if (!spotlight.visible || !rect) return null;

  const pad = spotlight.phase === "press" ? 8 : 12;
  return (
    <div
      className="pointer-events-none fixed z-[9998] rounded-[18px] bg-[rgba(var(--dls-accent-rgb),0.1)] shadow-[0_0_0_9999px_rgba(7,10,18,0.08),0_0_36px_rgba(var(--dls-accent-rgb),0.32),inset_0_0_0_1px_rgba(var(--dls-accent-rgb),0.24)] transition-all duration-200 ease-out"
      style={{
        left: `${rect.x - pad}px`,
        top: `${rect.y - pad}px`,
        width: `${rect.width + pad * 2}px`,
        height: `${rect.height + pad * 2}px`,
        transform: spotlight.phase === "press" ? "scale(0.985)" : "scale(1)",
      }}
    />
  );
}

export function OpenworkControlProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const actionsRef = useRef(new Map<string, RegisteredAction>());
  const listenersRef = useRef(new Set<(snapshot: OpenworkControlSnapshot) => void>());
  const contextRef = useRef<OpenworkContextSnapshot | null>(null);
  const contextRevisionRef = useRef(0);
  const nextOrderRef = useRef(1);
  const [version, setVersion] = useState(0);
  const [enabledState, setEnabledState] = useState(false);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [narration, setNarration] = useState(() => t("status.control_mode_off"));
  const [spotlight, setSpotlight] = useState<SpotlightState>({ visible: false, phase: "target", rect: null });
  const busyActionIdRef = useRef<string | null>(null);
  const busyActorRef = useRef<string | null>(null);
  const spotlightRunRef = useRef(0);
  const apiRef = useRef<OpenworkControlAPI | null>(null);

  const route = `${location.pathname}${location.search}${location.hash}`;
  const enabled = enabledState;
  const status: OpenworkControlSnapshot["status"] = !enabled ? "off" : busyActionId ? "acting" : "ready";

  const setEnabled = useCallback((nextEnabled: boolean) => {
    setEnabledState(nextEnabled);
  }, []);

  const listActionMetadata = useCallback((nextBusyActionId = busyActionId) => {
    return Array.from(actionsRef.current.values())
      .sort((left, right) => left.order - right.order)
      .map((action) => metadataForAction(action, nextBusyActionId));
  }, [busyActionId, version]);

  const actions = useMemo(() => {
    return listActionMetadata();
  }, [listActionMetadata]);

  const snapshot = useCallback((): OpenworkControlSnapshot => ({
    version: CONTROL_API_VERSION,
    enabled,
    route,
    status,
    busyActionId,
    narration,
    actions: listActionMetadata(),
  }), [busyActionId, enabled, listActionMetadata, narration, route, status]);

  const publishContext = useCallback((context: OpenworkContextSnapshot) => {
    if (contextRef.current === context) return;
    contextRef.current = context;
    contextRevisionRef.current += 1;
  }, []);

  const contextSnapshot = useCallback((): OpenworkContextSnapshot => {
    const availableAffordances = listActionMetadata().map(affordanceForAction);
    const published = contextRef.current;
    const revision = contextRevisionRef.current;
    if (published) {
      return {
        ...published,
        revision,
        capturedAt: new Date().toISOString(),
        availableAffordances,
        execution: {
          ...published.execution,
          busyCommandId: busyActionId,
          busyActor: busyActorRef.current,
        },
      };
    }
    return {
      schemaVersion: 1,
      revision,
      capturedAt: new Date().toISOString(),
      screen: { kind: "other", route },
      conversations: { tabs: [], layout: { kind: "empty" }, pinnedSessionIds: [] },
      chrome: {
        sidebarOpen: true,
        applicationMenuVisible: false,
        rightSidebarExpanded: false,
      },
      execution: {
        queries: "parallel",
        commands: "serialized",
        busyCommandId: busyActionId,
        busyActor: busyActorRef.current,
      },
      sidePanel: {
        open: false,
        ownerSessionId: null,
        kind: null,
        tabs: [],
        activeTabId: null,
      },
      resources: [{
        ref: `screen:${route}`,
        kind: "screen",
        title: "OpenWork",
        provider: { id: "openwork-ui", kind: "builtin" },
        state: { kind: "other", route },
      }],
      availableAffordances,
      contributions: [],
    };
  }, [busyActionId, listActionMetadata, route]);

  const registerAction = useCallback((actionId: string, actionRef: ControlActionRef) => {
    const token = Symbol(actionId);
    const previous = actionsRef.current.get(actionId);
    actionsRef.current.set(actionId, {
      id: actionId,
      order: previous?.order ?? nextOrderRef.current++,
      token,
      ref: actionRef,
    });
    contextRevisionRef.current += 1;
    setVersion((current) => current + 1);

    return () => {
      const current = actionsRef.current.get(actionId);
      if (current?.token === token) {
        actionsRef.current.delete(actionId);
        contextRevisionRef.current += 1;
        setVersion((value) => value + 1);
      }
    };
  }, []);

  const playTargetChoreography = useCallback(async (action: OpenworkControlAction, runId: number) => {
    if (!isBrowser()) return;
    const stillCurrent = () => spotlightRunRef.current === runId;
    const target = action.targetRef?.current;
    if (!target) {
      await wait(SPOTLIGHT_TIMING_MS.missingTarget);
      return;
    }

    target.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    await wait(SPOTLIGHT_TIMING_MS.scrollIntoView);
    if (!stillCurrent() || !target.isConnected) return;
    const rect = target.getBoundingClientRect();
    setSpotlight({
      visible: true,
      phase: "target",
      rect: {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      },
    });
    await wait(SPOTLIGHT_TIMING_MS.target);
    if (!stillCurrent()) return;
    setSpotlight((current) => ({ ...current, phase: "press" }));
    await wait(SPOTLIGHT_TIMING_MS.press);
    if (!stillCurrent()) return;
    setSpotlight((current) => ({ ...current, phase: "target" }));
    await wait(SPOTLIGHT_TIMING_MS.release);
  }, []);

  const executeAction = useCallback(async (
    actionId: string,
    args?: unknown,
    origin?: OpenworkAffordanceOrigin,
    bridged = false,
  ): Promise<OpenworkControlResult> => {
    const registered = actionsRef.current.get(actionId);
    const action = registered?.ref.current;
    if (!registered || !action) return { ok: false, actionId, error: t("status.control_unknown_action", { id: actionId }) };
    if (action.disabled) return { ok: false, actionId, error: t("status.control_action_disabled", { label: action.label }) };
    if (busyActionIdRef.current) {
      const busyId = busyActionIdRef.current;
      return {
        ok: false,
        actionId,
        error: busyActorRef.current
          ? t("status.control_already_acting_by", { id: busyId, actor: busyActorRef.current })
          : t("status.control_already_acting", { id: busyId }),
        code: "conflict",
      };
    }

    if (action.requiresConfirmation && isBrowser()) {
      const confirmed = window.confirm(t("status.control_confirm_action", { label: action.label }));
      if (!confirmed) return { ok: false, actionId, error: t("status.control_user_cancelled") };
    }

    const runId = spotlightRunRef.current + 1;
    spotlightRunRef.current = runId;
    busyActionIdRef.current = action.id;
    contextRevisionRef.current += 1;
    setEnabled(true);
    setBusyActionId(action.id);
    setNarration(t("status.control_moving_to", { label: action.label }));

    try {
      await playTargetChoreography(action, runId);
      setNarration(t("status.control_running_action", { label: action.label }));
      const effectiveArgs = args === undefined ? action.previewArgs : args;
      const result = await action.execute(effectiveArgs, { setNarration, origin, bridged });
      const resultError = returnedActionError(result);
      if (resultError) {
        setNarration(t("status.control_could_not", { label: action.label, error: resultError.error }));
        if (spotlightRunRef.current === runId) {
          setSpotlight({ visible: false, phase: "target", rect: null });
        }
        return { ok: false, actionId, ...resultError };
      }
      setNarration(t("status.control_done", { label: action.label }));
      await wait(SPOTLIGHT_TIMING_MS.done);
      if (spotlightRunRef.current === runId) {
        setSpotlight({ visible: false, phase: "target", rect: null });
      }
      return { ok: true, actionId, result };
    } catch (error) {
      const message = describeError(error);
      setNarration(t("status.control_could_not", { label: action.label, error: message }));
      if (spotlightRunRef.current === runId) {
        setSpotlight({ visible: false, phase: "target", rect: null });
      }
      return { ok: false, actionId, error: message };
    } finally {
      if (busyActionIdRef.current === action.id) busyActionIdRef.current = null;
      contextRevisionRef.current += 1;
      setBusyActionId(null);
    }
  }, [playTargetChoreography, setEnabled]);

  const queryAffordance = useCallback(async (
    request: OpenworkAffordanceRequest,
  ): Promise<OpenworkAffordanceResult> => {
    const action = actionsRef.current.get(request.id)?.ref.current;
    const revision = contextRevisionRef.current;
    if (!action || action.kind !== "query") {
      return {
        ok: false,
        id: request.id,
        error: t("status.control_unknown_query", { id: request.id }),
        code: "unavailable",
        revision,
      };
    }
    if (action.disabled) {
      return {
        ok: false,
        id: request.id,
        error: t("status.control_query_disabled", { label: action.label }),
        code: "unavailable",
        revision,
      };
    }
    try {
      const effectiveArgs = request.args === undefined ? action.previewArgs : request.args;
      const result = await action.execute(effectiveArgs, { setNarration: () => undefined, bridged: false });
      const resultError = returnedActionError(result);
      if (resultError) {
        return {
          ok: false,
          id: request.id,
          error: resultError.error,
          code: resultError.code ?? "failed",
          ...(resultError.hint ? { hint: resultError.hint } : {}),
          revision,
        };
      }
      return {
        ok: true,
        id: request.id,
        result,
        revision,
        effects: action.effects ?? { data: "read", ui: "none", external: false },
      };
    } catch (error) {
      return {
        ok: false,
        id: request.id,
        error: describeError(error),
        code: "failed",
        revision,
      };
    }
  }, []);

  const executeCommand = useCallback(async (
    request: OpenworkAffordanceRequest,
  ): Promise<OpenworkAffordanceResult> => {
    const action = actionsRef.current.get(request.id)?.ref.current;
    const revision = contextRevisionRef.current;
    if (!action || action.kind === "query") {
      return {
        ok: false,
        id: request.id,
        error: t("status.control_unknown_command", { id: request.id }),
        code: "unavailable",
        revision,
      };
    }
    if (busyActionIdRef.current) {
      const busyId = busyActionIdRef.current;
      return {
        ok: false,
        id: request.id,
        error: busyActorRef.current
          ? t("status.control_already_acting_by", { id: busyId, actor: busyActorRef.current })
          : t("status.control_already_acting", { id: busyId }),
        code: "conflict",
        revision,
      };
    }
    if (request.expectedRevision !== undefined && request.expectedRevision !== revision) {
      return {
        ok: false,
        id: request.id,
        error: t("status.control_revision_changed", { expected: request.expectedRevision, actual: revision }),
        code: "conflict",
        revision,
      };
    }
    busyActorRef.current = request.actor ?? null;
    const result = await executeAction(request.id, request.args, request.origin, true);
    if (!busyActionIdRef.current) busyActorRef.current = null;
    if (!result.ok) {
      return {
        ok: false,
        id: request.id,
        error: result.error,
        code: result.code ?? "failed",
        ...(result.hint ? { hint: result.hint } : {}),
        revision: contextRevisionRef.current,
      };
    }
    const sideEffect = action.sideEffect ?? "none";
    return {
      ok: true,
      id: request.id,
      result: result.result,
      revision: contextRevisionRef.current,
      effects: action.effects ?? effectsForSideEffect(sideEffect),
    };
  }, [executeAction]);

  const value = useMemo<OpenworkControlContextValue>(() => ({
    enabled,
    setEnabled,
    route,
    narration,
    busyActionId,
    actions,
    registerAction,
    executeAction,
    publishContext,
    snapshot,
  }), [
    actions,
    busyActionId,
    enabled,
    executeAction,
    narration,
    publishContext,
    registerAction,
    route,
    setEnabled,
    snapshot,
  ]);

  useEffect(() => {
    if (!enabled) {
      setNarration(t("status.control_mode_off"));
    } else if (narration === t("status.control_mode_off")) {
      setNarration(t("status.control_ready"));
    }
  }, [enabled, narration]);

  useEffect(() => {
    if (!isBrowser()) return;

    const api: OpenworkControlAPI = {
      version: CONTROL_API_VERSION,
      snapshot,
      listActions: () => snapshot().actions,
      execute: executeAction,
      context: contextSnapshot,
      query: queryAffordance,
      command: executeCommand,
      setEnabled,
      subscribe(listener) {
        listenersRef.current.add(listener);
        listener(snapshot());
        return () => {
          listenersRef.current.delete(listener);
        };
      },
    };

    window.__openworkControl = api;
    apiRef.current = api;
    return () => {
      if (window.__openworkControl === api) {
        delete window.__openworkControl;
      }
      if (apiRef.current === api) {
        apiRef.current = null;
      }
    };
  }, [contextSnapshot, executeAction, executeCommand, queryAffordance, setEnabled, snapshot]);

  useUiControlMailbox(apiRef);

  useEffect(() => {
    busyActionIdRef.current = busyActionId;
  }, [busyActionId]);

  useEffect(() => {
    const next = snapshot();
    listenersRef.current.forEach((listener) => listener(next));
  }, [snapshot, version]);

  return (
    <OpenworkControlContext.Provider value={value}>
      {children}
      <ControlModeSpotlight spotlight={spotlight} />
    </OpenworkControlContext.Provider>
  );
}

export function useOpenworkControl() {
  return use(OpenworkControlContext);
}

export function usePublishOpenworkContext(context: OpenworkContextSnapshot) {
  const control = useOpenworkControl();
  const publishContext = control?.publishContext;

  useEffect(() => {
    publishContext?.(context);
  }, [context, publishContext]);
}

export function useControlAction(action: OpenworkControlAction | null | false | undefined) {
  const control = useOpenworkControl();
  const registerAction = control?.registerAction;
  const latestActionRef = useRef<OpenworkControlAction | null>(action || null);
  latestActionRef.current = action || null;
  const actionId = action ? action.id : null;

  useEffect(() => {
    if (!registerAction || !actionId) return undefined;
    return registerAction(actionId, latestActionRef);
  }, [actionId, registerAction]);
}

/**
 * Register a dynamic list of control actions. Unlike calling useControlAction
 * per item, this scales to an arbitrary, changing number of actions without
 * violating the rules of hooks. Each action is tracked by its stable id; the
 * latest closure for that id is always used, and removed ids are unregistered.
 */
export function useControlActions(actions: readonly OpenworkControlAction[]) {
  const control = useOpenworkControl();
  const registerAction = control?.registerAction;

  // One ref per action id, so executeAction always sees the freshest closure.
  const refsById = useRef<Map<string, { current: OpenworkControlAction | null }>>(new Map());
  for (const action of actions) {
    const existing = refsById.current.get(action.id);
    if (existing) {
      existing.current = action;
    } else {
      refsById.current.set(action.id, { current: action });
    }
  }

  const ids = actions.map((action) => action.id).join("\u0000");

  useEffect(() => {
    if (!registerAction) return undefined;
    const liveIds = new Set(actions.map((action) => action.id));
    // Drop refs for ids that no longer exist.
    for (const id of Array.from(refsById.current.keys())) {
      if (!liveIds.has(id)) refsById.current.delete(id);
    }
    const cleanups = actions.map((action) => {
      const ref = refsById.current.get(action.id);
      return ref ? registerAction(action.id, ref) : undefined;
    });
    return () => {
      for (const cleanup of cleanups) cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerAction, ids]);
}

import { SETTINGS_TAB_VALUES } from "../../../app/types";
import { settingsNavigationFromPathname } from "../workspace-routes";

const SETTINGS_TABS: ReadonlySet<string> = new Set<string>(
  SETTINGS_TAB_VALUES.filter((tab) => tab !== "extensions"),
);

export function OpenworkRouteControlActions() {
  const navigate = useNavigate();
  const location = useLocation();
  // Read through a ref so the action list stays stable across route changes.
  const pathnameRef = useRef(location.pathname);
  pathnameRef.current = location.pathname;
  const openSettingsTab = useCallback((tab: string) => {
    const target = settingsNavigationFromPathname(pathnameRef.current, tab);
    navigate(target.to, { state: target.state });
  }, [navigate]);
  // Rebuild the action list when the language changes so labels stay translated.
  const controlLocale = currentLocale();

  const actions = useMemo<OpenworkControlAction[]>(() => [
    {
      id: "route.session",
      label: t("session.open_sessions"),
      description: t("session.open_sessions_desc"),
      sideEffect: "navigation",
      execute: () => navigate("/session"),
    },
    {
      id: "route.settings.general",
      label: t("session.open_general_settings"),
      description: t("session.open_general_settings_desc"),
      sideEffect: "navigation",
      execute: () => openSettingsTab("general"),
    },
    {
      id: "route.extensions.skills",
      label: t("session.open_extensions"),
      description: t("session.open_extensions_desc"),
      sideEffect: "navigation",
      execute: () => navigate("/extensions/skills"),
    },
    {
      id: "route.settings.providers",
      label: t("session.open_provider_settings"),
      description: t("session.open_provider_settings_desc"),
      sideEffect: "navigation",
      execute: () => openSettingsTab("ai"),
    },
    {
      id: "route.settings.authorized_folders",
      label: t("session.open_folder_settings"),
      description: t("session.open_folder_settings_desc"),
      sideEffect: "navigation",
      execute: () => openSettingsTab("permissions"),
    },
    {
      id: "route.settings.appearance",
      label: t("session.open_appearance_settings"),
      description: t("session.open_appearance_settings_desc"),
      sideEffect: "navigation",
      execute: () => openSettingsTab("appearance"),
    },
    {
      id: "settings.panel.open",
      label: t("session.open_settings_panel"),
      description: t("session.open_settings_panel_desc"),
      sideEffect: "navigation",
      requiresArgs: true,
      args: [
        {
          name: "panel",
          type: "string",
          required: true,
          description:
            "Settings tab: general | ai | ollama | preferences | permissions | shell | environment | advanced | appearance | updates | recovery | debug | cloud-account | usage | cloud-providers",
        },
      ],
      previewArgs: { panel: "ai" },
      execute: (args) => {
        const requested = (args as { panel?: unknown } | undefined)?.panel;
        const panel = typeof requested === "string" ? requested.trim() : "";
        if (!SETTINGS_TABS.has(panel)) {
          return {
            ok: false,
            error: t("session.unknown_settings_panel", {
              panel: panel || t("settings.environment.empty_value"),
              options: Array.from(SETTINGS_TABS).join(", "),
            }),
          };
        }
        openSettingsTab(panel);
        return { ok: true, panel };
      },
    },
    {
      id: "route.back",
      label: t("session.go_back"),
      description: t("session.navigate_back_history"),
      sideEffect: "navigation",
      execute: () => navigate(-1),
    },
    {
      id: "route.forward",
      label: t("session.go_forward"),
      description: t("session.navigate_forward_history"),
      sideEffect: "navigation",
      execute: () => navigate(1),
    },
    {
      id: "help.capabilities",
      label: t("common.capabilities_title"),
      description: t("common.capabilities_desc"),
      kind: "query",
      effects: { data: "read", ui: "none", external: false },
      sideEffect: "none",
      execute: () => ({
        capabilities: [
          { id: "browse", label: t("common.capability_browse_web"), description: t("common.capability_browse_web_desc") },
          { id: "providers", label: t("common.capability_providers"), description: t("common.capability_providers_desc") },
          { id: "extensions", label: t("extensions.title"), description: t("extensions.subtitle") },
          { id: "files", label: t("common.capability_files"), description: t("common.capability_files_desc") },
          { id: "code", label: t("common.capability_code"), description: t("common.capability_code_desc") },
          { id: "skills", label: t("skills.title"), description: t("common.capability_skills_desc") },
          { id: "automations", label: t("palette.automations"), description: t("common.capability_automations_desc") },
          { id: "sharing", label: t("common.capability_sharing"), description: t("common.capability_sharing_desc") },
        ],
        hint: t("common.capabilities_hint"),
      }),
    },
  ], [navigate, openSettingsTab, controlLocale]);

  useControlActions(actions);
  return null;
}
