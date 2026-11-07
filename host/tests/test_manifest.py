import json
import stat

from thunderbird_tray import EXTENSION_ID, HOST_NAME, cli
from thunderbird_tray.manifest import (
    build_manifest,
    default_manifest_dir,
    manifest_path,
    read_manifest,
    remove_manifest,
    write_manifest,
)


def test_default_directory_is_the_mozilla_one(tmp_path):
    assert default_manifest_dir(tmp_path) == tmp_path / ".mozilla" / "native-messaging-hosts"


def test_manifest_allows_only_this_add_on(tmp_path):
    manifest = build_manifest(tmp_path / "host")
    assert manifest == {
        "name": HOST_NAME,
        "description": "Thunderbird Tray: system tray icon for Thunderbird",
        "path": str(tmp_path / "host"),
        "type": "stdio",
        "allowed_extensions": [EXTENSION_ID],
    }


def test_write_read_and_remove(tmp_path):
    directory = tmp_path / "hosts"
    target = write_manifest(directory, tmp_path / "host")
    assert target == manifest_path(directory)
    assert target.name == f"{HOST_NAME}.json"
    assert json.loads(target.read_text()) == build_manifest(tmp_path / "host")
    assert stat.S_IMODE(target.stat().st_mode) == 0o644
    assert read_manifest(directory) == build_manifest(tmp_path / "host")
    assert [path.name for path in directory.iterdir()] == [target.name]

    assert remove_manifest(directory)
    assert not remove_manifest(directory)
    assert read_manifest(directory) is None


def test_read_manifest_ignores_broken_files(tmp_path):
    manifest_path(tmp_path).write_text("{broken")
    assert read_manifest(tmp_path) is None
    manifest_path(tmp_path).write_text("[1, 2]")
    assert read_manifest(tmp_path) is None


def test_cli_install_and_uninstall(tmp_path, capsys):
    host = tmp_path / "thunderbird-tray-host"
    host.write_text("#!/bin/sh\n")
    directory = tmp_path / "hosts"
    assert cli.main(["--manifest-dir", str(directory), "install", "--host", str(host)]) == 0
    assert read_manifest(directory)["path"] == str(host)
    assert "Registered" in capsys.readouterr().out

    assert cli.main(["--manifest-dir", str(directory), "uninstall"]) == 0
    assert read_manifest(directory) is None
    assert cli.main(["--manifest-dir", str(directory), "uninstall"]) == 0
    assert "was not registered" in capsys.readouterr().out


def test_cli_install_fails_without_a_host(tmp_path, capsys):
    directory = tmp_path / "hosts"
    missing = tmp_path / "missing"
    assert cli.main(["--manifest-dir", str(directory), "install", "--host", str(missing)]) == 1
    assert not directory.exists()
    assert "Could not find" in capsys.readouterr().err
