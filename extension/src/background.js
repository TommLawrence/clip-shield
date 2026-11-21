const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

/**
 * ClipShield companion — MV3 service worker.
 *
 * Minimal permissions: sidePanel + contextMenus only. No host_permissions, no
 * content scripts, no scripting permission. Selection text is provided by
 * Chrome's context-menu API (info.selectionText), so the extension never
 * silently collects all webpage text or monitors browsing activity.
 *
 * Raw selected content lives only in the in-memory `pendingSelection` variable
 * (and then in the side panel's memory). It is never written to persistent
 * Chrome storage and is cleared once the side panel has consumed it.
 */
const MENU_ID = "clipshield-protect-selection";
const WORKSPACE_URL = "https://clipshield.db.app";

let pendingSelection = null;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Protect selection with ClipShield",
    contexts: ["selection"],
  });
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {
      /* setPanelBehavior may be unavailable on older Chrome; the side panel still opens via open(). */
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !info.selectionText) return;
  pendingSelection = info.selectionText;
  if (tab && typeof tab.windowId === "number") {
    chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "ready") {
    sendResponse({ type: "selection", text: pendingSelection });
    pendingSelection = null;
    return false;
  }
  if (message?.type === "open-workspace") {
    chrome.tabs.create({ url: WORKSPACE_URL });
    return false;
  }
  return false;
});