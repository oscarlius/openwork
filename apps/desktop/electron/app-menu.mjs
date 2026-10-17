// Native application menu: template installation, the macOS/system menu
// actions that forward into the renderer (settings, updates, sidebar, zoom),
// and Windows/Linux menu-bar visibility. Extracted from main.mjs as a
// factory (createRuntimeManager pattern); the NATIVE_MENU_* channels are
// consumed by the preload bridge.
import { BrowserWindow, Menu, shell } from "electron";
import { runDetachedTask } from "./process-resilience.mjs";
import { setNativeLocale, t } from "./native-locale.mjs";

const NATIVE_MENU_OPEN_SETTINGS_EVENT = "openwork:native-menu:open-settings";
const NATIVE_MENU_TOGGLE_SIDEBAR_EVENT = "openwork:native-menu:toggle-sidebar";
const NATIVE_MENU_CHECK_UPDATES_EVENT = "openwork:native-menu:check-updates";
const NATIVE_MENU_ZOOM_EVENT = "openwork:native-menu:zoom";

export function createApplicationMenu({ appName, docsUrl, getWindow, closeBrowserTab }) {
  let applicationMenuVisible = process.platform === "darwin";
  let currentAppName = appName;

  async function openSettingsFromNativeMenu() {
    const win = await getWindow();
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    win.webContents.send(NATIVE_MENU_OPEN_SETTINGS_EVENT);
  }

  async function checkForUpdatesFromNativeMenu() {
    const win = await getWindow();
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    win.webContents.send(NATIVE_MENU_CHECK_UPDATES_EVENT);
  }

  async function toggleSidebarFromNativeMenu() {
    const win = await getWindow();
    win.webContents.send(NATIVE_MENU_TOGGLE_SIDEBAR_EVENT);
  }

  // Zoom must flow through the renderer's font-zoom pathway so the persisted
  // preference and the applied webContents zoom factor never drift apart. The
  // built-in resetZoom/zoomIn/zoomOut roles bypass that pathway (and zoom
  // whichever webContents is focused, including the embedded browser view).
  async function zoomFromNativeMenu(action) {
    const win = await getWindow();
    win.webContents.send(NATIVE_MENU_ZOOM_EVENT, action);
  }

  function install() {
    const isMac = process.platform === "darwin";
    const closeItem = {
      label: t("appMenu.close"),
      accelerator: "CommandOrControl+W",
      click: (_item, focusedWindow) => {
        const host = focusedWindow ?? BrowserWindow.getFocusedWindow();
        if (host && !closeBrowserTab?.(host)) host.close();
      },
    };
    const template = /** @type {import("electron").MenuItemConstructorOptions[]} */ ([
      ...(isMac
        ? [
            {
              label: currentAppName,
              submenu: [
                { role: "about" },
                {
                  label: t("appMenu.checkForUpdates"),
                  click: () => {
                    runDetachedTask("check for updates from menu", checkForUpdatesFromNativeMenu);
                  },
                },
                { type: "separator" },
                {
                  label: t("appMenu.settingsEllipsis"),
                  accelerator: "Command+,",
                  click: () => {
                    runDetachedTask("open settings from menu", openSettingsFromNativeMenu);
                  },
                },
                { type: "separator" },
                { role: "services" },
                { type: "separator" },
                { role: "hide" },
                { role: "hideOthers" },
                { role: "unhide" },
                { type: "separator" },
                { role: "quit" },
              ],
            },
          ]
        : []),
      {
        label: t("appMenu.file"),
        submenu: [
          ...(isMac
            ? []
            : [
                {
                  label: t("appMenu.settings"),
                  accelerator: "Control+,",
                  click: () => {
                    runDetachedTask("open settings from menu", openSettingsFromNativeMenu);
                  },
                },
                { type: "separator" },
              ]),
          closeItem,
        ],
      },
      {
        label: t("appMenu.edit"),
        submenu: [
          { role: "undo" },
          { role: "redo" },
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          { role: "paste" },
          ...(isMac
            ? [
                { role: "pasteAndMatchStyle" },
                { role: "delete" },
                { role: "selectAll" },
                { type: "separator" },
                {
                  label: t("appMenu.speech"),
                  submenu: [
                    { role: "startSpeaking" },
                    { role: "stopSpeaking" },
                  ],
                },
                { type: "separator" },
                {
                  label: t("appMenu.settingsEllipsis"),
                  click: () => {
                    runDetachedTask("open settings from menu", openSettingsFromNativeMenu);
                  },
                },
              ]
            : [
                { role: "delete" },
                { type: "separator" },
                { role: "selectAll" },
              ]),
        ],
      },
      {
        label: t("appMenu.view"),
        submenu: [
          {
            label: t("appMenu.toggleSidebar"),
            accelerator: "CommandOrControl+B",
            click: () => {
              runDetachedTask("toggle sidebar from menu", toggleSidebarFromNativeMenu);
            },
          },
          { type: "separator" },
          { role: "reload" },
          { role: "forceReload" },
          { role: "toggleDevTools" },
          { type: "separator" },
          {
            label: t("appMenu.actualSize"),
            accelerator: "CommandOrControl+0",
            click: () => {
              runDetachedTask("reset zoom from menu", () => zoomFromNativeMenu("reset"));
            },
          },
          {
            label: t("appMenu.zoomIn"),
            accelerator: "CommandOrControl+Plus",
            click: () => {
              runDetachedTask("zoom in from menu", () => zoomFromNativeMenu("in"));
            },
          },
          {
            label: t("appMenu.zoomOut"),
            accelerator: "CommandOrControl+-",
            click: () => {
              runDetachedTask("zoom out from menu", () => zoomFromNativeMenu("out"));
            },
          },
          { type: "separator" },
          { role: "togglefullscreen" },
        ],
      },
      {
        label: t("appMenu.window"),
        submenu: [
          { role: "minimize" },
          { role: "zoom" },
          ...(isMac
            ? [
                { type: "separator" },
                { role: "front" },
                { type: "separator" },
                { role: "window" },
              ]
            : [
                closeItem,
              ]),
        ],
      },
      {
        role: "help",
        submenu: [
          ...(isMac
            ? []
            : [
                {
                  label: t("appMenu.checkForUpdates"),
                  click: () => {
                    runDetachedTask("check for updates from menu", checkForUpdatesFromNativeMenu);
                  },
                },
                { type: "separator" },
              ]),
          {
            label: t("appMenu.docs"),
            click: () => {
              runDetachedTask("open documentation from menu", () => shell.openExternal(docsUrl));
            },
          },
        ],
      },
    ]);

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  }

  function applyVisibility(window) {
    if (process.platform === "darwin") return;
    window.setAutoHideMenuBar(false);
    window.setMenuBarVisibility(applicationMenuVisible);
  }

  function setVisible(visible) {
    applicationMenuVisible = visible === true;
    for (const window of BrowserWindow.getAllWindows()) {
      applyVisibility(window);
    }
    return applicationMenuVisible;
  }

  function setAppName(nextAppName) {
    currentAppName = typeof nextAppName === "string" && nextAppName.trim() ? nextAppName.trim() : appName;
    install();
    return currentAppName;
  }

  // Rebuild (never mutate in place) the application menu when the renderer's
  // language changes, so labels come from the active dictionary instead of
  // whatever locale was current at first install.
  function setLocale(nextLocale) {
    const applied = setNativeLocale(nextLocale);
    install();
    return applied;
  }

  return { install, applyVisibility, setVisible, setAppName, setLocale };
}
