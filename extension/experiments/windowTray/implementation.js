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
var { setTimeout, clearTimeout } = ChromeUtils.importESModule(
  "resource://gre/modules/Timer.sys.mjs"
);

const MAIN_WINDOW_URL = "chrome://messenger/content/messenger.xhtml";
const MAIN_WINDOW_TYPE = "mail:3pane";
const SHOW_ALERT_PREF = "mail.biff.show_alert";
const OFFLINE_TOPIC = "network:offline-status-changed";
const SPACES = { addressBook: "addressbook", calendar: "calendar", tasks: "tasks" };
// A copy of the "start hidden" setting. Extension storage is not readable yet
// when this experiment starts, early enough to hide the first window before
// it is ever drawn.
const START_HIDDEN_PREF = "extensions.thunderbird-tray.startHidden";
// A window hidden at startup is shown again if the tray icon has not appeared
// by then, so that a missing tray program never leaves Thunderbird invisible.
const STARTUP_GRACE_MS = 20_000;

function baseWindowOf(win) {
  return win.docShell.treeOwner.QueryInterface(Ci.nsIBaseWindow);
}

/**
 * Thunderbird finishes starting up, add-on background pages included, after
 * the first paint of its main window. A window hidden before it is drawn is
 * never painted, so this starts that part right away, as Thunderbird's own
 * start-in-tray does on Windows (gMailInit.onLoad in messenger.js). If these
 * internals change, the startup grace period shows the window instead.
 */
function releaseDelayedStartup(win) {
  const init = win.gMailInit;
  if (init?._boundDelayedStartup && !init.delayedStartupFinished) {
    init._delayedStartup();
  }
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
    this.hideAtStartup = false;
    this.graceTimer = null;
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

  /**
   * Hides the first main window as soon as it has loaded, before it is drawn.
   * Called only when Thunderbird itself starts, not when the add-on does.
   */
  startHidden() {
    this.hideAtStartup = true;
    this.graceTimer = setTimeout(() => {
      this.graceTimer = null;
      this.hideAtStartup = false;
      if (!this.options.enabled) {
        this.showAll({ focus: false });
      }
    }, STARTUP_GRACE_MS);
  }

  stop() {
    if (!this.started) {
      return;
    }
    this.started = false;
    clearTimeout(this.graceTimer);
    this.graceTimer = null;
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
    if (this.hideAtStartup) {
      this.hideAtStartup = false;
      const hideBeforePaint = () => {
        this.hideWindow(win);
        releaseDelayedStartup(win);
        // In case Thunderbird's own load handler had not run yet.
        setTimeout(() => releaseDelayedStartup(win), 0);
      };
      if (win.document.readyState == "complete") {
        hideBeforePaint();
      } else {
        // Hidden at "load", Gecko never maps the window at all.
        win.addEventListener("load", hideBeforePaint, { once: true });
      }
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

  configure({ startHidden, ...options }) {
    if (typeof startHidden == "boolean") {
      Services.prefs.setBoolPref(START_HIDDEN_PREF, startHidden);
    }
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
  ensureController() {
    if (!this.controller) {
      this.controller = new TrayController(this.extension.id);
      this.controller.start();
    }
    return this.controller;
  }

  // Runs at add-on startup, well before the background page, because the
  // manifest lists this API under "events": ["startup"].
  onStartup() {
    if (this.controller) {
      return;
    }
    this.controller = new TrayController(this.extension.id);
    if (
      this.extension.startupReason == "APP_STARTUP" &&
      Services.prefs.getBoolPref(START_HIDDEN_PREF, false)
    ) {
      // Before start(), which attaches to windows that are already open.
      this.controller.startHidden();
    }
    this.controller.start();
  }

  static onUninstall() {
    Services.prefs.clearUserPref(START_HIDDEN_PREF);
  }

  getAPI(context) {
    const controller = this.ensureController();

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
