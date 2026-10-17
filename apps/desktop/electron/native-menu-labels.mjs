// Label dictionaries for the Electron main process's native surfaces
// (application menu + native context menus). One flat key per visible string;
// every dictionary must stay key-identical to the English one, which holds the
// exact strings shipped before localization. Role-based menu items (undo,
// copy, quit, ...) are intentionally absent: Electron localizes those itself.
//
// Typography rules followed by the zh dictionary (repo i18n style):
// - half-width space between Chinese and Latin/digits (no Latin appears in the
//   current entries, keep the rule in mind when adding);
// - full-width punctuation, no trailing period on menu items;
// - brand names (OpenWork, Docs→文档 is not a brand) stay per the repo glossary.

/** @typedef {"en" | "zh"} NativeMenuLocale */

/** @type {Record<NativeMenuLocale, Record<string, string>>} */
export const NATIVE_MENU_LABELS = {
  en: {
    "appMenu.file": "File",
    "appMenu.edit": "Edit",
    "appMenu.view": "View",
    "appMenu.window": "Window",
    "appMenu.close": "Close",
    "appMenu.settings": "Settings",
    "appMenu.settingsEllipsis": "Settings...",
    "appMenu.checkForUpdates": "Check for Updates...",
    "appMenu.speech": "Speech",
    "appMenu.toggleSidebar": "Toggle Sidebar",
    "appMenu.actualSize": "Actual Size",
    "appMenu.zoomIn": "Zoom In",
    "appMenu.zoomOut": "Zoom Out",
    "appMenu.docs": "Docs",
    "contextMenu.addToDictionary": "Add to Dictionary",
    "contextMenu.copyImage": "Copy Image",
    "contextMenu.copyImageAddress": "Copy Image Address",
    "contextMenu.copyLinkAddress": "Copy Link Address",
  },
  zh: {
    "appMenu.file": "文件",
    "appMenu.edit": "编辑",
    "appMenu.view": "视图",
    "appMenu.window": "窗口",
    "appMenu.close": "关闭",
    "appMenu.settings": "设置",
    "appMenu.settingsEllipsis": "设置…",
    "appMenu.checkForUpdates": "检查更新…",
    "appMenu.speech": "语音",
    "appMenu.toggleSidebar": "切换侧边栏",
    "appMenu.actualSize": "实际大小",
    "appMenu.zoomIn": "放大",
    "appMenu.zoomOut": "缩小",
    "appMenu.docs": "文档",
    "contextMenu.addToDictionary": "添加到词典",
    "contextMenu.copyImage": "复制图片",
    "contextMenu.copyImageAddress": "复制图片地址",
    "contextMenu.copyLinkAddress": "复制链接地址",
  },
};
