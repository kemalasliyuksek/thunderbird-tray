"""The native messaging manifest that tells Thunderbird where the tray program is."""

from __future__ import annotations

import json
import os
import shutil
import sysconfig
import tempfile
from pathlib import Path
from typing import Any

from . import EXTENSION_ID, HOST_NAME

HOST_EXECUTABLE = "thunderbird-tray-host"


def default_manifest_dir(home: Path | None = None) -> Path:
    # Thunderbird on Linux reads user manifests from the same directory as
    # Firefox ("XREUserNativeManifests").
    return (home or Path.home()) / ".mozilla" / "native-messaging-hosts"


def manifest_path(directory: Path) -> Path:
    return directory / f"{HOST_NAME}.json"


def build_manifest(host_executable: Path) -> dict[str, Any]:
    return {
        "name": HOST_NAME,
        "description": "Thunderbird Tray: system tray icon for Thunderbird",
        "path": str(host_executable),
        "type": "stdio",
        "allowed_extensions": [EXTENSION_ID],
    }


def find_host_executable() -> Path | None:
    """The host script installed next to this package, or the one on PATH."""
    candidate = Path(sysconfig.get_path("scripts")) / HOST_EXECUTABLE
    if candidate.is_file() and os.access(candidate, os.X_OK):
        return candidate.absolute()
    found = shutil.which(HOST_EXECUTABLE)
    return Path(found).absolute() if found else None


def write_manifest(directory: Path, host_executable: Path) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    target = manifest_path(directory)
    content = json.dumps(build_manifest(host_executable), indent=2) + "\n"
    # Write and rename, so Thunderbird never reads a half-written file.
    with tempfile.NamedTemporaryFile(
        "w", dir=directory, prefix=f".{HOST_NAME}.", suffix=".tmp", delete=False, encoding="utf-8"
    ) as handle:
        handle.write(content)
        temporary = Path(handle.name)
    temporary.chmod(0o644)
    temporary.replace(target)
    return target


def read_manifest(directory: Path) -> dict[str, Any] | None:
    try:
        data = json.loads(manifest_path(directory).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return data if isinstance(data, dict) else None


def remove_manifest(directory: Path) -> bool:
    try:
        manifest_path(directory).unlink()
    except FileNotFoundError:
        return False
    return True
