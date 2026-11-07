# Security

## Reporting a vulnerability

Please report vulnerabilities privately through
[GitHub security advisories](https://github.com/kemalasliyuksek/thunderbird-tray/security/advisories/new)
and not in a public issue.

## Security model

| Concern | How it is handled |
| --- | --- |
| Who can start the tray program | Thunderbird starts it only for the add-on named in the native messaging manifest (`allowed_extensions`). It talks over stdin and stdout only: it opens no sockets and makes no network connections. |
| What the add-on can do | It runs with full access to Thunderbird, as every add-on with an experiment API does. Its experiment exposes only hiding and showing windows, the alert preference, and a fixed list of Thunderbird commands. |
| Mail content | Senders and subjects are shown as plain text in the menu, with `&` escaped. The tooltip holds only counts and account names. Message text is never put in markup, a command line or a file name. |
| Programs it starts | Only the Thunderbird executable that is running, with `--profile` and the running profile, both reported by Thunderbird itself and checked to exist. No shell is involved. |
| Malformed messages | Incoming messages are length-checked (8 MiB at most) and parsed defensively; unknown or invalid fields are ignored. |
| Data on disk | Only the native messaging manifest. The debug log, written only with `THUNDERBIRD_TRAY_DEBUG=1`, contains senders and subjects of recent mail. |

## What this does not protect against

Software running as your user can already read your Thunderbird profile, replace the tray program or
edit the manifest. Treat it as trusted, as you would for Thunderbird itself.
