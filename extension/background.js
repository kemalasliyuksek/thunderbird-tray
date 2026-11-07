// SPDX-License-Identifier: MIT

import { HostConnection } from "./modules/host.js";
import { collectLabels } from "./modules/labels.js";
import { DEFAULT_SETTINGS, normalizeSettings } from "./modules/settings.js";
import { RECENT_DAYS, isCountedFolder, selectRecent, summarize } from "./modules/summary.js";

const PROTOCOL_VERSION = 1;
const REFRESH_DELAY_MS = 300;
/** Stop reading unread messages for the recent list after this many. */
const MAX_SCANNED = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

let settings = { ...DEFAULT_SETTINGS };
let windowState = { hidden: false, active: false, muted: false, offline: false };
/** The last full state sent, reused for window changes, which need no recount. */
let lastState = null;
let launchInfo = null;
let appStartup = false;
let startupHandled = false;

browser.runtime.onStartup.addListener(() => {
  appStartup = true;
});

const host = new HostConnection({
  connect: name => browser.runtime.connectNative(name),
  onReady: () => onHostReady(),
  onMessage: message => onHostMessage(message),
  onLost: () => onHostLost(),
});

async function onHostReady() {
  await applyWindowOptions();
  host.send({
    type: "hello",
    protocol: PROTOCOL_VERSION,
    version: browser.runtime.getManifest().version,
    launch: launchInfo,
    labels: collectLabels(key => browser.i18n.getMessage(key)),
  });
  await refresh();
  if (appStartup && settings.startHidden && !startupHandled) {
    await browser.windowTray.hide();
  }
  startupHandled = true;
}

async function onHostLost() {
  // Shows any hidden window, since nothing could bring it back now.
  await applyWindowOptions();
}

function applyWindowOptions() {
  return browser.windowTray.configure({
    enabled: host.ready,
    closeToTray: settings.closeToTray,
    minimizeToTray: settings.minimizeToTray,
  });
}

async function onHostMessage(message) {
  if (message?.type != "command") {
    return;
  }
  try {
    await runCommand(message);
  } catch (error) {
    console.error(`Tray command "${message.command}" failed:`, error);
  }
}

async function runCommand({ command, messageId, value }) {
  switch (command) {
    case "show":
      await browser.windowTray.show();
      break;
    case "hide":
      await browser.windowTray.hide();
      break;
    case "compose":
      await browser.compose.beginNew();
      break;
    case "getMail":
      await browser.windowTray.runCommand("getMail");
      break;
    case "addressBook":
    case "calendar":
    case "tasks":
      await browser.windowTray.runCommand(command);
      requestActivation();
      break;
    case "openMessage":
      if (!Number.isInteger(messageId)) {
        throw new Error("openMessage needs an integer messageId");
      }
      await browser.windowTray.show();
      await browser.messageDisplay.open({ messageId, location: "tab" });
      requestActivation();
      break;
    case "setMuted":
      await browser.windowTray.setMuted(Boolean(value));
      break;
    case "setOffline":
      if (windowState.offline != Boolean(value)) {
        await browser.windowTray.runCommand("toggleOffline");
      }
      break;
    case "openSettings":
      await browser.windowTray.show();
      await browser.runtime.openOptionsPage();
      requestActivation();
      break;
    case "quit":
      await browser.windowTray.runCommand("quit");
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

/**
 * Asks the tray program to bring the main window to the front. On Wayland a
 * window can only take focus with an activation token, which Thunderbird gets
 * when it is launched again, so the tray program does exactly that.
 */
function requestActivation() {
  host.send({ type: "activate" });
}

let refreshTimer = null;
let refreshing = null;
let refreshAgain = false;

function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(refresh, REFRESH_DELAY_MS);
}

async function refresh() {
  if (!host.ready) {
    return;
  }
  if (refreshing) {
    refreshAgain = true;
    return;
  }
  refreshing = (async () => {
    try {
      lastState = await buildState();
      host.send(lastState);
    } catch (error) {
      console.error("Could not collect the unread state:", error);
    }
  })();
  await refreshing;
  refreshing = null;
  if (refreshAgain) {
    refreshAgain = false;
    await refresh();
  }
}

/**
 * Folder info for each folder. A folder that cannot be read, for example one
 * whose index is being rebuilt, is left out instead of failing the whole state.
 */
async function withInfo(folders) {
  const results = await Promise.allSettled(
    folders.map(async folder => ({ folder, info: await browser.folders.getFolderInfo(folder.id) }))
  );
  return results.flatMap((result, index) => {
    if (result.status == "fulfilled") {
      return [result.value];
    }
    console.warn(`Skipping folder ${folders[index].path}:`, result.reason);
    return [];
  });
}

async function buildState() {
  const accounts = await browser.accounts.list(false);
  const unreadFolders = await browser.folders.query({ hasUnreadMessages: true });
  const counted = await withInfo(unreadFolders.filter(f => isCountedFolder(f, settings.countMode)));
  const inboxes = await withInfo(await browser.folders.query({ specialUse: ["inbox"] }));
  const summary = summarize({ accounts, counted, inboxes });
  const accountNames = new Map(accounts.map(account => [account.id, account.name]));
  let messages = [];
  try {
    messages = await queryUnread(counted.map(({ folder }) => folder.id));
  } catch (error) {
    console.warn("Could not list recent unread messages:", error);
  }
  return {
    type: "state",
    ...summary,
    recent: selectRecent(messages, settings.recentCount, accountNames),
    window: windowState,
    settings: { showBadge: settings.showBadge, middleClick: settings.middleClick },
  };
}

async function queryUnread(folderIds) {
  if (settings.recentCount == 0 || folderIds.length == 0) {
    return [];
  }
  const found = [];
  let page = await browser.messages.query({
    folderId: folderIds,
    unread: true,
    fromDate: new Date(Date.now() - RECENT_DAYS * DAY_MS),
  });
  found.push(...page.messages);
  while (page.id && found.length < MAX_SCANNED) {
    page = await browser.messages.continueList(page.id);
    found.push(...page.messages);
  }
  if (page.id) {
    await browser.messages.abortList(page.id).catch(() => {});
  }
  return found;
}

async function loadSettings() {
  const stored = await browser.storage.local.get("settings");
  settings = normalizeSettings(stored.settings);
}

async function main() {
  await loadSettings();
  launchInfo = await browser.windowTray.getLaunchInfo();
  windowState = await browser.windowTray.getState();

  browser.windowTray.onStateChanged.addListener(state => {
    windowState = state;
    if (lastState) {
      lastState = { ...lastState, window: state };
      host.send(lastState);
    }
  });
  browser.runtime.onMessage.addListener(message => {
    if (message?.type == "getStatus") {
      return Promise.resolve({ connected: host.ready });
    }
    return undefined;
  });
  browser.storage.onChanged.addListener(async (changes, area) => {
    if (area == "local" && changes.settings) {
      settings = normalizeSettings(changes.settings.newValue);
      await applyWindowOptions();
      scheduleRefresh();
    }
  });
  for (const event of [
    browser.folders.onFolderInfoChanged,
    browser.folders.onCreated,
    browser.folders.onDeleted,
    browser.messages.onNewMailReceived,
    browser.messages.onUpdated,
    browser.messages.onDeleted,
    browser.messages.onMoved,
    browser.accounts.onCreated,
    browser.accounts.onDeleted,
    browser.accounts.onUpdated,
  ]) {
    event.addListener(scheduleRefresh);
  }

  host.start();
}

main().catch(error => console.error("Thunderbird Tray failed to start:", error));
