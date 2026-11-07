# addons.thunderbird.net listing

The text for the add-on's page on [addons.thunderbird.net](https://addons.thunderbird.net). Keep it in
step with the README when features change.

- **Name:** Tray for Thunderbird (from `extension/_locales/*/messages.json`)
- **Homepage:** https://github.com/kemalasliyuksek/thunderbird-tray
- **Support site:** https://github.com/kemalasliyuksek/thunderbird-tray/issues
- **License:** MIT
- **Privacy policy:** the full text of [PRIVACY.md](../PRIVACY.md), pasted into the privacy policy field.
  ATN does not accept a link.

## Screenshots

Upload in this order, with these captions:

1. `docs/screenshots/menu.png`: The tray menu: recent unread messages and quick actions.
2. `docs/screenshots/tooltip.png`: Unread badge and tooltip with counts per account.
3. `docs/screenshots/settings.png`: Settings.

All mail in them is made up; they were taken with a test profile.

## Summary

At most 250 characters.

> Keeps Thunderbird running in the system tray on Linux, Wayland included. Closing the window hides it,
> so mail and notifications keep coming. Unread count, recent mail and quick actions in the tray. Needs
> the free companion tray program.

## Description

ATN accepts a small subset of HTML in descriptions.

```html
Thunderbird can hide to the system tray only on Windows. This add-on brings it to Linux, Wayland included, without forcing Thunderbird onto X11.

<b>Features</b>
<ul>
<li>Closing the main window hides it to the tray instead of quitting, so new mail keeps arriving and notifications keep showing. Optionally, minimizing hides it too.</li>
<li>A click on the tray icon brings the window back, focused; a click while it is in front hides it.</li>
<li>Unread count on the icon, for inboxes or all folders.</li>
<li>Tooltip with unread and new mail per account, a warning when a mailbox is nearly full, and offline and alert status.</li>
<li>Menu with the newest unread messages (one click opens them), Write, Get New Messages, Address Book, Calendar, Tasks, Do Not Disturb, Work Offline and Quit.</li>
<li>Optionally starts hidden in the tray, without the window flashing on screen.</li>
<li>English and Turkish.</li>
</ul>

<b>Companion tray program required</b>
Add-ons cannot draw a tray icon on Linux, so this add-on works together with a small open source tray program (Python and Qt), which Thunderbird starts and stops itself through native messaging. Install it from the project's releases page and run "thunderbird-tray install" once; the README has the steps:
https://github.com/kemalasliyuksek/thunderbird-tray#installation

Windows are only hidden while the tray icon is running, so Thunderbird can never get lost. The Flatpak and Snap versions of Thunderbird cannot start the tray program. Tested on KDE Plasma (Wayland); other desktops with a StatusNotifierItem tray should work.

<b>Privacy</b>
The add-on sends account names, unread counts, mailbox quota, and the sender, subject and date of a few recent unread messages to the tray program on your own computer, only to show them in the tray. Nothing leaves your computer and nothing is collected. See the privacy policy for details.

<b>Why full access</b>
Thunderbird shows that this add-on has full access because it uses an Experiment API. That is needed to hide the main window and catch its close button, which the regular add-on APIs cannot do.
```

## Description, Turkish (tr locale)

```html
Thunderbird yalnızca Windows'ta sistem tepsisine gizlenebiliyor. Bu eklenti bunu Linux'a, Wayland dahil, Thunderbird'ü X11'e zorlamadan getirir.

<b>Özellikler</b>
<ul>
<li>Ana pencereyi kapatmak Thunderbird'ü kapatmaz, tepsiye gizler; yeni postalar gelmeye ve bildirimler görünmeye devam eder. İsterseniz simge durumuna küçültmek de gizler.</li>
<li>Tepsi simgesine tıklamak pencereyi odaklanmış olarak geri getirir; pencere öndeyken tıklamak gizler.</li>
<li>Simgede okunmamış sayısı: gelen kutularında ya da tüm klasörlerde.</li>
<li>İpucunda hesap başına okunmamış ve yeni iletiler, dolmak üzere olan posta kutusu uyarısı, çevrimdışı ve bildirim durumu.</li>
<li>Menüde en yeni okunmamış iletiler (tek tıkla açılır), İleti Yaz, Yeni İletileri Al, Adres Defteri, Takvim, Görevler, Rahatsız Etme, Çevrimdışı Çalış ve Çık.</li>
<li>İsteğe bağlı olarak tepside gizli başlar; pencere ekranda bir an bile görünmez.</li>
<li>İngilizce ve Türkçe.</li>
</ul>

<b>Tepsi programı gerekir</b>
Eklentiler Linux'ta tepsi simgesi çizemediği için bu eklenti küçük, açık kaynak bir tepsi programıyla (Python ve Qt) birlikte çalışır; programı Thunderbird native messaging ile kendisi başlatıp durdurur. Programı projenin sürümler sayfasından kurup bir kez "thunderbird-tray install" çalıştırın; adımlar README'de:
https://github.com/kemalasliyuksek/thunderbird-tray/blob/main/README.tr.md#kurulum

Pencereler yalnızca tepsi simgesi çalışırken gizlenir, yani Thunderbird hiçbir zaman kaybolmaz. Thunderbird'ün Flatpak ve Snap sürümleri tepsi programını başlatamaz. KDE Plasma'da (Wayland) test edildi; StatusNotifierItem tepsisi olan diğer masaüstlerinde de çalışması beklenir.

<b>Gizlilik</b>
Eklenti hesap adlarını, okunmamış sayılarını, posta kutusu kotasını ve birkaç son okunmamış iletinin göndereni, konusu ve tarihini yalnızca tepside göstermek için kendi bilgisayarınızdaki tepsi programına gönderir. Hiçbir şey bilgisayarınızdan çıkmaz ve hiçbir veri toplanmaz. Ayrıntılar gizlilik politikasında.

<b>Neden tam erişim</b>
Thunderbird, bu eklentinin bir Experiment API kullandığı için tam erişimi olduğunu gösterir. Ana pencereyi gizlemek ve kapatma düğmesini yakalamak için buna ihtiyaç var; normal eklenti API'leri bunu yapamıyor.
```

## Notes to reviewers

```text
Source: the XPI is the source. There is no build step, bundler or minification; scripts/build-xpi.py
only zips extension/. The XPI is reproducible: running it on the tagged commit gives identical bytes.
Repository: https://github.com/kemalasliyuksek/thunderbird-tray (tag v<version>).

Why an Experiment: Thunderbird can hide its main window to the tray only on Windows, in native code
(nsIMessengerWindowsIntegration). On Linux there is no WebExtension API to hide a window or to intercept
its close button. The experiment "windowTray" (experiments/windowTray/) does only that:
- catches the "close" event of the last main window and sets nsIBaseWindow.visibility = false;
- shows the window again, and replaces window.focus() while hidden so that relaunching Thunderbird or
  clicking a new-mail notification brings it back;
- optionally hides the first window at startup before it is painted, and then runs
  gMailInit._delayedStartup() as Thunderbird's own start-in-tray does on Windows;
- runs three Thunderbird commands that have no WebExtension API: get new messages, toggle offline, quit;
- sets mail.biff.show_alert for "Do Not Disturb".
Everything else (counting, recent messages, compose, opening messages and spaces) uses WebExtension APIs.
Control logic is in background.js and modules/.

Safety: windows are hidden only while the companion program is connected; when it disconnects, or the
add-on is disabled, removed or updated, all hidden windows are shown again. A window hidden at startup is
shown after 20 seconds if the companion program has not connected.

Native messaging: the companion program "com.kemalasliyuksek.thunderbird_tray" (Python/PyQt6, MIT,
in host/ of the same repository) shows the tray icon. Data sent to it is listed in the privacy policy and
docs/protocol.md. It makes no network connections.

Testing: without the companion program the add-on does nothing visible (its settings page says the tray
program is not running). To test fully on Linux: install the wheel from the GitHub release with
"uv tool install" or "pipx install", run "thunderbird-tray install", restart Thunderbird.

Tested with Thunderbird 140.17.0esr, 158.0, 159.0 and 160.0b5 on Fedora 45, KDE Plasma 6.8, Wayland.
```
