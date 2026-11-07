/* SPDX-License-Identifier: MIT */
"use strict";

// Thunderbird hides its main window to the tray only on Windows, through a
// native service that Linux builds do not have. This experiment does the same
// with Gecko's own window visibility, which works on Wayland and X11 alike.

var { ExtensionCommon } = ChromeUtils.importESModule(
  "resource://gre/modules/ExtensionCommon.sys.mjs"
);
var { ExtensionSupport } = ChromeUtils.importESModule(
  "resource:///modules/ExtensionSupport.sys.mjs"
);

const MAIN_WINDOW_URL = "chrome://messenger/content/messenger.xhtml";
const MAIN_WINDOW_TYPE = "mail:3pane";
const SHOW_ALERT_PREF = "mail.biff.show_alert";
const OFFLINE_TOPIC = "network:offline-status-changed";
const SPACES = { addressBook: "addressbook", calendar: "calendar", tasks: "tasks" };

function baseWindowOf(win) {
  return win.docShell.treeOwner.QueryInterface(Ci.nsIBaseWindow);
}

class TrayController {
  constructor(id) {
    this.id = id;
    this.options = { enabled: false, closeToTray: true, minimizeToTray: false };
    this.hooks = new Map();
    // Original focus() of each hidden window. While a window is hidden its
    // focus() is replaced, because that is what Thunderbird calls when it is
    // launched again or a new mail notification is clicked.
    this.originalFocus = new Map();
    this.listeners = new Set();
    // The main window that has the focus, tracked from activate and
    // deactivate events. Services.focus.activeWindow is not used: while a
    // deactivate event runs it still names the window that is losing focus.
    this.activeWindow = null;
    this.started = false;
  }

  start() {
    if (this.started) {
      return;
    }
    this.started = true;
    ExtensionSupport.registerWindowListener(this.id, {
      chromeURLs: [MAIN_WINDOW_URL],
      onLoadWindow: win => this.attach(win),
      onUnloadWindow: win => this.detach(win),
    });
    Services.prefs.addObserver(SHOW_ALERT_PREF, this);
    Services.obs.addObserver(this, OFFLINE_TOPIC);
  }

  stop() {
    if (!this.started) {
      return;
    }
    this.started = false;
    ExtensionSupport.unregisterWindowListener(this.id);
    Services.prefs.removeObserver(SHOW_ALERT_PREF, this);
    Services.obs.removeObserver(this, OFFLINE_TOPIC);
    for (const win of [...this.hooks.keys()]) {
      this.detach(win);
    }
    this.listeners.clear();
  }

  // nsIObserver, for the alert preference and the offline state.
  observe() {
    this.notify();
  }

  attach(win) {
    if (this.hooks.has(win)) {
      return;
    }
    const onClose = event => {
      if (!this.options.enabled || !this.options.closeToTray) {
        return;
      }
      // Closing one of several main windows should still close it.
      if (this.visibleMainWindows().some(other => other != win)) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      this.hideWindow(win);
    };
    const onSizeModeChange = () => {
      if (
        this.options.enabled &&
        this.options.minimizeToTray &&
        win.windowState == win.STATE_MINIMIZED
      ) {
        this.hideWindow(win);
      }
    };
    const onActivate = () => {
      this.activeWindow = win;
      this.notify();
    };
    const onDeactivate = () => {
      if (this.activeWindow == win) {
        this.activeWindow = null;
      }
      this.notify();
    };
    if (Services.focus.activeWindow == win) {
      this.activeWindow = win;
    }
    // Capture, so that this runs before Thunderbird's own close handlers.
    win.addEventListener("close", onClose, true);
    win.addEventListener("sizemodechange", onSizeModeChange);
    win.addEventListener("activate", onActivate);
    win.addEventListener("deactivate", onDeactivate);
    this.hooks.set(win, { onClose, onSizeModeChange, onActivate, onDeactivate });
  }

  detach(win) {
    const hook = this.hooks.get(win);
    if (!hook) {
      return;
    }
    this.hooks.delete(win);
    win.removeEventListener("close", hook.onClose, true);
    win.removeEventListener("sizemodechange", hook.onSizeModeChange);
    win.removeEventListener("activate", hook.onActivate);
    win.removeEventListener("deactivate", hook.onDeactivate);
    if (this.activeWindow == win) {
      this.activeWindow = null;
    }
    if (!win.closed) {
      this.showWindow(win, { focus: false });
    }
    this.originalFocus.delete(win);
    this.notify();
  }

  mainWindows() {
    return [...Services.wm.getEnumerator(MAIN_WINDOW_TYPE)].filter(win => !win.closed);
  }

  visibleMainWindows() {
    return this.mainWindows().filter(win => !this.originalFocus.has(win));
  }

  hideWindow(win) {
    if (this.originalFocus.has(win)) {
      return;
    }
    baseWindowOf(win).visibility = false;
    if (this.activeWindow == win) {
      this.activeWindow = null;
    }
    this.originalFocus.set(win, win.focus);
    win.focus = () => this.showWindow(win, { focus: true });
    this.notify();
  }

  showWindow(win, { focus }) {
    const originalFocus = this.originalFocus.get(win);
    if (originalFocus) {
      this.originalFocus.delete(win);
      win.focus = originalFocus;
      baseWindowOf(win).visibility = true;
      if (win.windowState == win.STATE_MINIMIZED) {
        win.restore();
      }
      this.notify();
    }
    if (focus) {
      win.focus();
    }
  }

  configure(options) {
    this.options = { ...this.options, ...options };
    if (!this.options.enabled) {
      // Without the tray icon there would be no way back to a hidden window.
      this.showAll({ focus: false });
    }
  }

  hideAll() {
    if (!this.options.enabled) {
      return;
    }
    for (const win of this.mainWindows()) {
      this.hideWindow(win);
    }
  }

  showAll({ focus }) {
    for (const win of this.mainWindows()) {
      this.showWindow(win, { focus });
    }
  }

  mostRecentMainWindow() {
    return Services.wm.getMostRecentWindow(MAIN_WINDOW_TYPE);
  }

  getState() {
    const windows = this.mainWindows();
    const active = this.activeWindow;
    return {
      hidden: windows.length > 0 && windows.every(win => this.originalFocus.has(win)),
      active: windows.includes(active) && !this.originalFocus.has(active),
      muted: !Services.prefs.getBoolPref(SHOW_ALERT_PREF, true),
      offline: Services.io.offline,
    };
  }

  notify() {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  runCommand(command) {
    const win = this.mostRecentMainWindow();
    if (!win) {
      throw new Error("No main Thunderbird window is open");
    }
    switch (command) {
      case "getMail":
        // When offline, Thunderbird asks whether to go online first.
        if (Services.io.offline) {
          this.showWindow(win, { focus: true });
        }
        win.MsgGetMessagesForAllAuthenticatedAccounts();
        break;
      case "addressBook":
      case "calendar":
      case "tasks": {
        this.showWindow(win, { focus: true });
        const toolbar = win.gSpacesToolbar;
        const space = toolbar.spaces.find(s => s.name == SPACES[command]);
        toolbar.openSpace(win.document.getElementById("tabmail"), space);
        break;
      }
      case "toggleOffline":
        win.MailOfflineMgr.toggleOfflineStatus();
        break;
      case "quit":
        win.goQuitApplication();
        break;
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }
}

var windowTray = class extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {
    if (!this.controller) {
      this.controller = new TrayController(context.extension.id);
      this.controller.start();
    }
    const controller = this.controller;

    return {
      windowTray: {
        async configure(options) {
          controller.configure(options);
        },
        async getState() {
          return controller.getState();
        },
        async getLaunchInfo() {
          return {
            executable: Services.dirsvc.get("XREExeF", Ci.nsIFile).path,
            profileDir: Services.dirsvc.get("ProfD", Ci.nsIFile).path,
          };
        },
        async hide() {
          controller.hideAll();
        },
        async show() {
          controller.showAll({ focus: true });
        },
        async setMuted(muted) {
          Services.prefs.setBoolPref(SHOW_ALERT_PREF, !muted);
        },
        async runCommand(command) {
          controller.runCommand(command);
        },
        onStateChanged: new ExtensionCommon.EventManager({
          context,
          name: "windowTray.onStateChanged",
          register: fire => {
            const listener = state => fire.async(state);
            controller.listeners.add(listener);
            return () => controller.listeners.delete(listener);
          },
        }).api(),
      },
    };
  }

  onShutdown(isAppShutdown) {
    if (isAppShutdown || !this.controller) {
      return;
    }
    // Disabled, removed or updated: never leave a window hidden behind.
    this.controller.stop();
    this.controller = null;
  }
};
