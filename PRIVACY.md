# Privacy Policy

Tray for Thunderbird collects no data, sends nothing over the network and contains no analytics or
telemetry.

## What the add-on reads

To show the tray icon, the add-on reads, inside Thunderbird:

- the names of your accounts;
- the number of unread and new messages in your folders, and the storage quota that IMAP servers report
  for your inboxes;
- the sender name, subject, date and account of up to 15 recent unread messages (at most 14 days old),
  for the "Recent unread" menu;
- whether Thunderbird is working offline and whether new mail alerts are turned on.

It does not read message bodies, attachments or passwords, and it passes on no message details other
than those listed here.

## Where it goes

This information is sent only to the add-on's companion tray program, through Thunderbird's native
messaging. The companion program runs on your own computer, as your user, and is started and stopped by
Thunderbird. It uses the information only to draw the tray icon, its tooltip and its menu, and keeps it
in memory only. It does not send it anywhere, and it opens no network connections.

The companion program sends back only your clicks in the tray menu, such as "open this message" or
"hide the window".

The one exception is an optional debug log. If you start Thunderbird with the environment variable
`THUNDERBIRD_TRAY_DEBUG=1`, the companion program writes the messages it exchanges with the add-on,
including the sender names and subjects above, to `~/.local/state/thunderbird-tray/host.log` on your
computer. It is off unless you turn it on, and you can delete the file at any time.

## What is stored

- The add-on's settings, in Thunderbird's storage for the add-on.
- A copy of the "Start hidden in the tray" setting in Thunderbird's preferences
  (`extensions.thunderbird-tray.startHidden`), removed when the add-on is disabled or removed.
- When you use "Do Not Disturb", Thunderbird's own preference for new mail alerts
  (`mail.biff.show_alert`) is changed, exactly as in Thunderbird's settings.

## Contact

Questions and reports: https://github.com/kemalasliyuksek/thunderbird-tray/issues
