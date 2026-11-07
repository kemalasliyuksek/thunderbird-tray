# Tray for Thunderbird

System tray icon for Thunderbird on Linux: hides the window to the tray instead of quitting, shows the
unread count and quick actions. Open source, MIT. Code, comments, docs and commits in English; the only
other language is `README.tr.md` and the Turkish locale.

- `extension/`: the Thunderbird add-on (MailExtension, MV2 for a persistent background page).
  `modules/` has no Thunderbird dependency and is unit tested; `experiments/windowTray/` is privileged
  and only testable in a running Thunderbird.
- `host/`: the tray program (Python, PyQt6, uv), started by Thunderbird through native messaging.
- `docs/architecture.md` explains hiding and focus on Wayland; `docs/protocol.md` the messages.

Read the project rules in `CONTRIBUTING.md` before changing behavior. Above all: never leave a window
hidden without a way back, and treat mail senders and subjects as untrusted plain text.

## Commands

```bash
pnpm test && pnpm check && pnpm build    # add-on tests, syntax check, dist/*.xpi
cd host && uv run ruff check . && uv run ruff format --check . && uv run pytest
```

## Working on Thunderbird code

Check Thunderbird internals against its own sources rather than from memory: unpack
`/usr/lib64/thunderbird/omni.ja` into a scratch directory and grep it. MailExtension schemas are in
`chrome/messenger/content/messenger/schemas/`.

Try changes in a separate profile as described in `CONTRIBUTING.md`, never in the user's own profile.
Run Thunderbird and the tray program outside the Claude Code sandbox: GUI programs cannot reach D-Bus or
the compositor inside it. The tray can be driven through D-Bus (`org.kde.StatusNotifierItem.Activate`,
`com.canonical.dbusmenu.Event`), and KWin scripts can list or close windows, so tests need no mouse.
Do not take screenshots or focus windows while the user is working.

The tray program's stderr goes to Thunderbird's Error Console, not to the terminal. Use
`THUNDERBIRD_TRAY_DEBUG=1` and read `~/.local/state/thunderbird-tray/host.log`.
