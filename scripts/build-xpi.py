#!/usr/bin/env python3
"""Packs extension/ into dist/thunderbird-tray-<version>.xpi.

The archive is reproducible: files are sorted and get a fixed timestamp, so
the same sources always give the same bytes.
"""

from __future__ import annotations

import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "extension"
OUTPUT = ROOT / "dist"
FIXED_TIME = (2020, 1, 1, 0, 0, 0)


def files_to_pack() -> list[Path]:
    return sorted(
        path
        for path in SOURCE.rglob("*")
        if path.is_file() and not any(part.startswith(".") for part in path.relative_to(SOURCE).parts)
    )


def main() -> int:
    version = json.loads((SOURCE / "manifest.json").read_text(encoding="utf-8"))["version"]
    OUTPUT.mkdir(exist_ok=True)
    target = OUTPUT / f"thunderbird-tray-{version}.xpi"
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in files_to_pack():
            info = zipfile.ZipInfo(path.relative_to(SOURCE).as_posix(), FIXED_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, path.read_bytes())
    print(target.relative_to(ROOT))
    return 0


if __name__ == "__main__":
    sys.exit(main())
