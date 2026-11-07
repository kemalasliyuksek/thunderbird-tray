# Architecture

Thunderbird can hide its window to the system tray only on Windows. The code for it lives in a native
Windows service (`nsIMessengerWindowsIntegration`), so the "minimize to tray" options do nothing on Linux,
and there is no tray icon. Thunderbird Tray adds both, in two parts:

```
┌──────────────────────── Thunderbird ────────────────────────┐        ┌──────── tray program ────────┐
│                                                             │        │                              │
│  windowTray experiment ◄──── background.js ◄──── MailExt APIs        │  Qt tray icon (SNI, D-Bus)   │
│  (hide, show, commands)      (counts, recent,   (folders,   │ stdio  │  badge, tooltip, menu        │
│                               settings)          messages)  │◄──────►│                              │
│                                                             │ native │  launches Thunderbird again  │
│                                                             │ messag.│  to raise its window         │
└─────────────────────────────────────────────────────────────┘        └──────────────────────────────┘
```

- **The add-on** (`extension/`) counts unread mail through the regular MailExtension APIs and talks to
  the tray program. Its `windowTray` experiment API does what those APIs cannot: hide a window, catch
  its close button and run a few of Thunderbird's own commands.
- **The tray program** (`host/`, Python and Qt) shows the icon. Thunderbird starts it through native
  messaging when the add-on connects and stops it when Thunderbird quits, so it never runs on its own.

## Hiding the window

The experiment listens for the `close` event of each main window (`mail:3pane`) in the capture phase.
When the last visible main window is closed, it cancels the event and sets
`nsIBaseWindow.visibility = false`. GTK then unmaps the window, which works the same on Wayland and X11:
the window leaves the screen, the taskbar and the window switcher, and Thunderbird keeps running.
Closing one of several main windows still closes it. Minimizing can hide the window too, through the
`sizemodechange` event, when that option is on.

### Getting it back

Thunderbird brings its main window forward by calling `window.focus()`, both when it is launched while
already running and when a new mail notification is clicked. While a window is hidden, the experiment
replaces that window's `focus` with a function that shows the window first. On Gecko, `focus` is an own
property of the window object, so the original is saved and put back rather than deleted.

### Focus on Wayland

A Wayland window may only take the focus with an activation token from the compositor, and a window
shown again by the program itself has none. A second Thunderbird process does: when it starts, it hands
its command line and a token to the running Thunderbird and exits within about a tenth of a second. So
to raise the window, the tray program runs `thunderbird --profile <the running profile>`, passing on the
token Plasma gave it with the click (`XDG_ACTIVATION_TOKEN`). Thunderbird focuses its main window, and
the experiment shows it. If that launch is not possible (Thunderbird runs with `--no-remote`, or the
executable is gone), the tray program asks the add-on to show the window directly, without the focus.

Opening a message, the address book, the calendar or the settings from the menu works the same way:
the add-on does the work and then asks the tray program to raise the window.

## Safety rules

A hidden window with no way back would look like a lost Thunderbird, so:

- Windows are hidden only while the tray program is connected. The add-on enables hiding when the
  program says `ready`, and disables it, showing every hidden window, when the connection drops. It then
  reconnects with a growing delay (2 s up to 1 min); Thunderbird starts a new tray program each time.
- When the add-on is disabled, removed or updated, the experiment's `onShutdown` shows every hidden
  window and restores everything it changed. On application shutdown it leaves the windows alone.
- Launching Thunderbird again always shows a hidden window, even without the tray icon.

## Counting

The add-on recounts after folder, message and account events, debounced by 300 ms, and never runs two
counts at once. It asks for folders with unread messages, keeps the ones that count (inboxes, or every
folder except Junk, Trash, Sent, Drafts, Templates, Archives and Outbox) and reads their
`unreadMessageCount` and `newMessageCount`. Unified, virtual and tag folders are skipped, since their
messages are already counted elsewhere. A folder that cannot be read is skipped instead of failing the
count. Storage quota comes from the inboxes, as reported by IMAP servers.

For the menu, it queries unread messages from the last 14 days in the counted folders, reads at most
500, and sends the newest few. Window changes (hidden, focused, muted, offline) are sent right away with
the last counts, without a recount.

## Text from mail

Senders and subjects come from whoever sent the mail. They travel as JSON and are shown only as plain
text: menu entries escape `&` so that it is not read as a keyboard accelerator, and the tooltip, which
Plasma shows as plain text, holds no message text at all, only counts and account names.
