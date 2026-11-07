# Changelog

All notable changes are listed here. The project follows [Semantic Versioning](https://semver.org/).

## 0.2.1 - 2026-11-07

- Declares the Thunderbird versions it was tested with, 140 to 160, as addons.thunderbird.net requires
  for add-ons with an Experiment API (`strict_max_version`). Tested with 140 ESR, 158, 159 and 160 beta.

## 0.2.0 - 2026-11-07

- Renamed to Tray for Thunderbird, as addons.thunderbird.net requires for names that contain
  "Thunderbird". The repository, the Python package and the commands keep the name `thunderbird-tray`.
- Address Book, Calendar and Tasks open through the built-in `spaces` API instead of the experiment.
- The copy of the "Start hidden" setting in Thunderbird's preferences is removed when the add-on is
  disabled or removed.
- Added a privacy policy (PRIVACY.md).
- The settings page lines up its controls, and the README shows screenshots.
- Tested with Thunderbird 140 ESR as well as 158.

## 0.1.0 - 2026-11-07

Released as Thunderbird Tray.

First release.

- Hide Thunderbird to the tray when its main window is closed, and optionally when it is minimized,
  on Wayland and X11.
- Bring the window back, focused, with a click on the icon, by launching Thunderbird again, or from a
  new mail notification.
- Unread count badge for inboxes or all folders, and a grayed icon when working offline.
- Tooltip with unread and new mail per account, mailbox quota warnings, and offline and alert status.
- Menu with recent unread messages, write, get mail, address book, calendar, tasks, Do Not Disturb,
  Work Offline, settings and quit.
- Optional start hidden in the tray, without the window flashing on screen.
- English and Turkish.
