# Contributing

Thanks for helping out. Bug reports, ideas and pull requests are all welcome. For a bug, please include
your distribution, desktop, Wayland or X11, the Thunderbird version and the output of
`thunderbird-tray status`.

## Project rules

1. **Never strand a window.** A window may be hidden only while something can bring it back: the tray
   program is connected, and launching Thunderbird again shows it. Anything that disables, removes or
   disconnects the add-on shows the hidden windows first.
2. **Do what Thunderbird would do.** Use Thunderbird's own commands and preferences (its offline
   manager, its quit checks, `mail.biff.show_alert`) rather than reimplementing them, so that its prompts
   and safety checks still apply.
3. **Mail content is untrusted.** Senders and subjects are plain text everywhere. Never put them in
   markup, a command line or a file name.
4. **Stay light.** Recounts are debounced and never overlap, and listing messages is bounded. A broken
   folder is skipped, not fatal.
5. **No network.** Neither part makes network connections of its own.

## Layout

- `extension/`: the Thunderbird add-on. `modules/` holds the logic that has no Thunderbird dependency and
  is unit tested. `experiments/windowTray/` is the privileged part and can only be tested in Thunderbird.
- `host/`: the tray program (Python, PyQt6), a [uv](https://docs.astral.sh/uv/) project.
- `tests/extension/`: tests for the add-on, run with Node's test runner.
- `scripts/build-xpi.py`: packs the add-on, reproducibly.
- `docs/`: architecture and protocol.

## Checks

```bash
pnpm test && pnpm check && pnpm build                     # add-on (Node is pinned in package.json)
cd host && uv run ruff check . && uv run ruff format --check . && uv run pytest
```

The add-on has no npm dependencies; pnpm is only used to run the pinned Node.

## Trying a change

Use a separate Thunderbird profile, so that your mail is not involved:

```bash
mkdir -p /tmp/tb-dev/extensions
echo "$PWD/extension" > /tmp/tb-dev/extensions/thunderbird-tray@kemalasliyuksek.com
# Enable add-ons placed in the profile without asking.
echo 'user_pref("extensions.autoDisableScopes", 0);' > /tmp/tb-dev/user.js
(cd host && uv run thunderbird-tray install --host "$PWD/.venv/bin/thunderbird-tray-host")
THUNDERBIRD_TRAY_DEBUG=1 thunderbird --profile /tmp/tb-dev
```

The file in `extensions/` points Thunderbird at the source directory, so a restart picks up changes.
`thunderbird-tray install` here registers the development copy of the tray program; run it again from
the installed tool to switch back. With `THUNDERBIRD_TRAY_DEBUG=1`, the tray program logs its messages
to `~/.local/state/thunderbird-tray/host.log`.

The tray icon can be driven without a mouse through D-Bus: `org.kde.StatusNotifierItem.Activate` is a
left click, and `com.canonical.dbusmenu.Event` with `clicked` picks a menu entry.

## Releases

The version is in `extension/manifest.json`, `package.json`, `host/pyproject.toml` and
`host/src/thunderbird_tray/__init__.py`; a test checks that they agree. Add the changes to
`CHANGELOG.md`.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/), in English.
