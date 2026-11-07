"""The native messaging host: started by Thunderbird, lives as long as Thunderbird."""

from __future__ import annotations

import logging
import os
import signal
import sys
import threading
from pathlib import Path
from typing import Any, BinaryIO

from PyQt6.QtCore import QObject, QTimer, pyqtSignal
from PyQt6.QtWidgets import QApplication, QSystemTrayIcon

from . import __version__
from .model import parse_hello, parse_state
from .protocol import ProtocolError, read_message, write_message
from .tray import Tray

PROTOCOL_VERSION = 1

log = logging.getLogger("thunderbird_tray")


class _Inbox(QObject):
    """Carries messages from the reading thread to the Qt thread."""

    received = pyqtSignal(object)
    closed = pyqtSignal()


def _read_forever(stream: BinaryIO, inbox: _Inbox) -> None:
    try:
        while (message := read_message(stream)) is not None:
            inbox.received.emit(message)
    except (ProtocolError, OSError) as error:
        log.error("lost the connection to Thunderbird: %s", error)
    inbox.closed.emit()


def _dispatch(tray: Tray, message: Any) -> None:
    if not isinstance(message, dict):
        return
    kind = message.get("type")
    log.debug("received %s: %s", kind, message)
    if kind == "hello":
        if message.get("protocol") != PROTOCOL_VERSION:
            log.warning(
                "the add-on speaks protocol %r, this program %r; update both to the same release",
                message.get("protocol"),
                PROTOCOL_VERSION,
            )
        tray.apply_hello(parse_hello(message))
    elif kind == "state":
        tray.apply_state(parse_state(message))
    elif kind == "activate":
        tray.activate_window()


def debug_log_path() -> Path:
    state = os.environ.get("XDG_STATE_HOME") or str(Path.home() / ".local" / "state")
    return Path(state) / "thunderbird-tray" / "host.log"


def _setup_logging() -> None:
    # Thunderbird shows what the program writes to stderr in its Error Console
    # (Tools > Developer Tools). With THUNDERBIRD_TRAY_DEBUG set, everything
    # sent and received also goes to a file that is easier to read.
    handlers: list[logging.Handler] = [logging.StreamHandler(sys.stderr)]
    debug = bool(os.environ.get("THUNDERBIRD_TRAY_DEBUG"))
    if debug:
        path = debug_log_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        handlers.append(logging.FileHandler(path, encoding="utf-8"))
    logging.basicConfig(
        level=logging.DEBUG if debug else logging.INFO,
        format="%(asctime)s thunderbird-tray: %(levelname)s: %(message)s",
        handlers=handlers,
    )


def main() -> int:
    _setup_logging()
    # stdout carries the protocol; anything printed by accident must not end up there.
    output = sys.stdout.buffer
    sys.stdout = sys.stderr

    # Thunderbird passes the manifest path and the add-on id as arguments.
    app = QApplication(sys.argv[:1])
    app.setApplicationName("thunderbird-tray")
    app.setApplicationDisplayName("Tray for Thunderbird")
    app.setQuitOnLastWindowClosed(False)

    if not QSystemTrayIcon.isSystemTrayAvailable():
        log.error("no system tray is available in this desktop session")
        return 1

    def send(message: dict[str, Any]) -> None:
        log.debug("sending %s", message)
        try:
            write_message(output, message)
        except (ProtocolError, OSError) as error:
            log.error("could not send to Thunderbird: %s", error)

    tray = Tray(send)
    inbox = _Inbox()
    inbox.received.connect(lambda message: _dispatch(tray, message))
    inbox.closed.connect(app.quit)
    threading.Thread(
        target=_read_forever, args=(sys.stdin.buffer, inbox), name="stdin", daemon=True
    ).start()

    for signum in (signal.SIGINT, signal.SIGTERM):
        signal.signal(signum, lambda *_: app.quit())
    # Python only runs signal handlers between bytecodes, so wake up now and then.
    wakeup = QTimer()
    wakeup.start(500)
    wakeup.timeout.connect(lambda: None)

    tray.show()
    send({"type": "ready", "protocol": PROTOCOL_VERSION, "version": __version__})
    status = app.exec()
    tray.hide()
    return status


if __name__ == "__main__":
    sys.exit(main())
