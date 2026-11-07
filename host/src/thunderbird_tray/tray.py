"""The tray icon and its menu, driven by the state the extension reports."""

from __future__ import annotations

import ctypes
from collections.abc import Callable
from typing import Any

from PyQt6.QtCore import QObject, qEnvironmentVariable
from PyQt6.QtGui import QAction
from PyQt6.QtWidgets import QMenu, QSystemTrayIcon

from . import launcher
from .icon import load_base_icon, render_icon
from .model import (
    DEFAULT_LABELS,
    Hello,
    LaunchInfo,
    TrayState,
    recent_label,
    tooltip_text,
)

Send = Callable[[dict[str, Any]], None]

_libc = ctypes.CDLL(None)


class Tray(QObject):
    def __init__(self, send: Send) -> None:
        super().__init__()
        self._send = send
        self._labels = dict(DEFAULT_LABELS)
        self._launch: LaunchInfo | None = None
        self._state = TrayState()
        self._icon_key: tuple[object, ...] | None = None
        self._menu_key: tuple[object, ...] | None = None
        self._base_icon = load_base_icon()

        self._menu = QMenu()
        self._icon = QSystemTrayIcon()
        self._icon.setContextMenu(self._menu)
        self._icon.activated.connect(self._on_activated)
        self._render()

    def show(self) -> None:
        self._icon.show()

    def hide(self) -> None:
        self._icon.hide()

    def apply_hello(self, hello: Hello) -> None:
        self._labels = hello.labels
        self._launch = hello.launch
        self._menu_key = None
        self._render()

    def apply_state(self, state: TrayState) -> None:
        self._state = state
        self._render()

    def activate_window(self) -> None:
        """Shows the main window and gives it the focus."""
        if not launcher.activate(self._launch, self._take_activation_token()):
            self._command("show")

    # Rendering

    def _render(self) -> None:
        state = self._state
        icon_key = (state.unread, state.show_badge, state.window.offline)
        if icon_key != self._icon_key:
            self._icon_key = icon_key
            self._icon.setIcon(
                render_icon(
                    self._base_icon,
                    unread=state.unread,
                    show_badge=state.show_badge,
                    offline=state.window.offline,
                )
            )
        # Plasma shows the tooltip Qt exports as plain text, so it is not escaped.
        self._icon.setToolTip(tooltip_text(state, self._labels))
        menu_key = (
            tuple(sorted(self._labels.items())),
            state.recent,
            state.window.hidden,
            state.window.muted,
            state.window.offline,
        )
        if menu_key != self._menu_key:
            self._menu_key = menu_key
            self._build_menu()

    def _build_menu(self) -> None:
        labels = self._labels
        state = self._state
        menu = self._menu
        menu.clear()

        if state.window.hidden:
            self._add(menu, labels["menuShow"], self.activate_window)
        else:
            self._add(menu, labels["menuHide"], lambda: self._command("hide"))

        if state.recent:
            menu.addSeparator()
            header = menu.addAction(labels["menuRecent"])
            header.setEnabled(False)
            for message in state.recent:
                self._add(
                    menu,
                    recent_label(message, labels),
                    lambda message_id=message.id: self._command(
                        "openMessage", messageId=message_id
                    ),
                )

        menu.addSeparator()
        self._add(menu, labels["menuCompose"], lambda: self._command("compose"))
        self._add(menu, labels["menuGetMail"], lambda: self._command("getMail"))
        self._add(menu, labels["menuAddressBook"], lambda: self._command("addressBook"))
        self._add(menu, labels["menuCalendar"], lambda: self._command("calendar"))
        self._add(menu, labels["menuTasks"], lambda: self._command("tasks"))

        menu.addSeparator()
        self._add_toggle(menu, labels["menuMuted"], state.window.muted, "setMuted")
        self._add_toggle(menu, labels["menuOffline"], state.window.offline, "setOffline")
        self._add(menu, labels["menuSettings"], lambda: self._command("openSettings"))

        menu.addSeparator()
        self._add(menu, labels["menuQuit"], lambda: self._command("quit"))

    def _add(self, menu: QMenu, text: str, handler: Callable[[], None]) -> QAction:
        action = menu.addAction(text)
        action.triggered.connect(lambda _checked=False: handler())
        return action

    def _add_toggle(self, menu: QMenu, text: str, checked: bool, command: str) -> None:
        action = menu.addAction(text)
        action.setCheckable(True)
        action.setChecked(checked)
        action.triggered.connect(lambda value: self._command(command, value=bool(value)))

    # Input

    def _on_activated(self, reason: QSystemTrayIcon.ActivationReason) -> None:
        if reason == QSystemTrayIcon.ActivationReason.Trigger:
            self._toggle_window()
        elif (
            reason == QSystemTrayIcon.ActivationReason.MiddleClick
            and self._state.middle_click != "none"
        ):
            self._command(self._state.middle_click)

    def _toggle_window(self) -> None:
        window = self._state.window
        if window.hidden or not window.active:
            self.activate_window()
        else:
            self._command("hide")

    def _command(self, name: str, **extra: Any) -> None:
        self._send({"type": "command", "command": name, **extra})

    @staticmethod
    def _take_activation_token() -> str | None:
        # Plasma hands a token over with the click, and Qt stores it in the
        # environment of this process. os.environ is a copy made at startup,
        # so it has to be read through Qt.
        token = qEnvironmentVariable("XDG_ACTIVATION_TOKEN")
        if token:
            # A token works once; never hand the same one over twice.
            _libc.unsetenv(b"XDG_ACTIVATION_TOKEN")
        return token or None
