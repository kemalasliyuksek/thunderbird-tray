# Native messaging protocol

The add-on and the tray program exchange JSON messages over the tray program's stdin and stdout, each
preceded by its length as a 32-bit unsigned integer in native byte order. This is Thunderbird's standard
native messaging framing. Messages from the tray program may be at most 1 MiB; the tray program rejects
incoming messages over 8 MiB as a broken stream.

The current protocol version is `1`. Both sides ignore fields they do not know, so fields may be added
without a new version. Removing or changing a field needs a new version.

## Tray program → add-on

### `ready`

Sent once at start. The add-on enables hiding only after this.

```json
{ "type": "ready", "protocol": 1, "version": "0.1.0" }
```

### `command`

```json
{ "type": "command", "command": "openMessage", "messageId": 42 }
```

| `command` | Extra fields | Effect |
| --- | --- | --- |
| `show` | | Show hidden windows. Used when the tray program cannot launch Thunderbird to raise them. |
| `hide` | | Hide all main windows. |
| `compose` | | Open a new message. |
| `getMail` | | Get new messages for all accounts that are logged in. |
| `addressBook`, `calendar`, `tasks` | | Open that space, then ask to be raised. |
| `openMessage` | `messageId` (integer) | Open the message in a tab, then ask to be raised. |
| `setMuted` | `value` (boolean) | Turn new mail alerts off (`true`) or on, through `mail.biff.show_alert`. |
| `setOffline` | `value` (boolean) | Work offline or online, with Thunderbird's usual prompts. |
| `openSettings` | | Open the add-on's settings, then ask to be raised. |
| `quit` | | Quit Thunderbird, with its usual checks for unsent messages. |

## Add-on → tray program

### `hello`

Sent after `ready`.

```json
{
  "type": "hello",
  "protocol": 1,
  "version": "0.1.0",
  "launch": { "executable": "/usr/lib64/thunderbird/thunderbird", "profileDir": "/home/me/.thunderbird/abcd.default" },
  "labels": { "menuShow": "Show Thunderbird", "unreadSummary": "{count} unread", "…": "…" }
}
```

`launch` is what the tray program runs to raise the window. `labels` are the strings it shows, in
Thunderbird's language; `{placeholders}` are filled in by the tray program. The keys are listed in
`extension/modules/labels.js`.

### `state`

Sent after every recount, and with the last counts whenever the window state changes.

```json
{
  "type": "state",
  "unread": 6,
  "newMessages": 1,
  "accounts": [
    { "id": "account1", "name": "Personal", "unread": 4, "newMessages": 1, "quotaPercent": 91 },
    { "id": "account2", "name": "Work", "unread": 2, "newMessages": 0, "quotaPercent": null }
  ],
  "recent": [
    { "id": 42, "author": "Ada Lovelace", "subject": "Notes", "date": "2026-11-07T16:35:51.000Z", "account": "Personal" }
  ],
  "window": { "hidden": false, "active": true, "muted": false, "offline": false },
  "settings": { "showBadge": true, "middleClick": "compose" }
}
```

`recent` is newest first. `author` and `subject` are at most 200 characters. `window.active` is true when
a main window has the focus, which decides whether a click on the icon hides the window or raises it.

### `activate`

Asks the tray program to raise the main window, after the add-on has opened something in it.

```json
{ "type": "activate" }
```
