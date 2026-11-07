"""Command line for setting up the tray program."""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

from . import EXTENSION_ID, __version__
from .manifest import (
    build_manifest,
    default_manifest_dir,
    find_host_executable,
    manifest_path,
    read_manifest,
    remove_manifest,
    write_manifest,
)


def _install(args: argparse.Namespace) -> int:
    host = Path(args.host).absolute() if args.host else find_host_executable()
    if host is None or not host.is_file():
        print(
            "Could not find the thunderbird-tray-host program. Install the package with "
            "'uv tool install thunderbird-tray' or pass --host.",
            file=sys.stderr,
        )
        return 1
    target = write_manifest(args.manifest_dir, host)
    print(f"Registered the tray program with Thunderbird: {target}")
    print(f"It points to {host}.")
    print("Restart Thunderbird if it is running, and install the Thunderbird Tray add-on.")
    return 0


def _uninstall(args: argparse.Namespace) -> int:
    if remove_manifest(args.manifest_dir):
        print(f"Removed {manifest_path(args.manifest_dir)}")
    else:
        print("The tray program was not registered.")
    return 0


def _tray_available() -> bool | None:
    try:
        from PyQt6.QtWidgets import QApplication, QSystemTrayIcon
    except ImportError:
        return None
    app = QApplication.instance() or QApplication([sys.argv[0]])
    available = QSystemTrayIcon.isSystemTrayAvailable()
    app.processEvents()
    return available


def _status(args: argparse.Namespace) -> int:
    problems = 0

    def report(ok: bool, text: str) -> None:
        nonlocal problems
        problems += 0 if ok else 1
        print(f"{'ok  ' if ok else 'FAIL'}  {text}")

    host = find_host_executable()
    report(host is not None, f"tray program: {host or 'not found'}")

    manifest = read_manifest(args.manifest_dir)
    location = manifest_path(args.manifest_dir)
    if manifest is None:
        report(False, f"not registered with Thunderbird ({location} is missing or invalid)")
    else:
        registered = Path(str(manifest.get("path", "")))
        report(
            registered.is_file() and EXTENSION_ID in manifest.get("allowed_extensions", []),
            f"registered with Thunderbird: {location} -> {registered}",
        )
        if host is not None and manifest != build_manifest(host):
            print("      note: the registration points elsewhere; run 'thunderbird-tray install'")

    thunderbird = shutil.which("thunderbird")
    report(thunderbird is not None, f"Thunderbird: {thunderbird or 'not found on PATH'}")

    tray = _tray_available()
    if tray is None:
        report(False, "PyQt6 is not installed")
    else:
        report(tray, "system tray is available" if tray else "no system tray in this session")
    return 1 if problems else 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="thunderbird-tray",
        description="Set up the system tray icon for Thunderbird.",
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    parser.add_argument(
        "--manifest-dir",
        type=Path,
        default=default_manifest_dir(),
        help="where Thunderbird looks for native messaging manifests (default: %(default)s)",
    )
    commands = parser.add_subparsers(dest="command", required=True)
    install = commands.add_parser("install", help="register the tray program with Thunderbird")
    install.add_argument("--host", help="path to thunderbird-tray-host (default: autodetect)")
    install.set_defaults(handler=_install)
    commands.add_parser("uninstall", help="remove the registration").set_defaults(
        handler=_uninstall
    )
    commands.add_parser("status", help="check the setup").set_defaults(handler=_status)

    args = parser.parse_args(argv)
    return args.handler(args)


if __name__ == "__main__":
    sys.exit(main())
