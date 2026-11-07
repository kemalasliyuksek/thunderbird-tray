import stat
import subprocess

import pytest

from thunderbird_tray import launcher
from thunderbird_tray.model import LaunchInfo


@pytest.fixture
def thunderbird(tmp_path):
    executable = tmp_path / "thunderbird"
    executable.write_text("#!/bin/sh\n")
    executable.chmod(executable.stat().st_mode | stat.S_IXUSR)
    profile = tmp_path / "profile"
    profile.mkdir()
    return LaunchInfo(str(executable), str(profile))


def test_can_launch_a_real_executable(thunderbird):
    assert launcher.can_launch(thunderbird, environ={})


def test_cannot_launch_without_info():
    assert not launcher.can_launch(None, environ={})


@pytest.mark.parametrize("variable", ["MOZ_NO_REMOTE", "MOZ_NEW_INSTANCE"])
def test_no_remote_disables_launching(thunderbird, variable):
    # A second process would not reach the running one and would find the profile in use.
    assert not launcher.can_launch(thunderbird, environ={variable: "1"})


def test_rejects_relative_missing_or_non_executable_paths(thunderbird, tmp_path):
    assert not launcher.can_launch(LaunchInfo("thunderbird", thunderbird.profile_dir), environ={})
    missing = str(tmp_path / "missing")
    assert not launcher.can_launch(LaunchInfo(missing, thunderbird.profile_dir), environ={})
    plain = tmp_path / "plain"
    plain.write_text("")
    assert not launcher.can_launch(LaunchInfo(str(plain), thunderbird.profile_dir), environ={})
    assert not launcher.can_launch(LaunchInfo(thunderbird.executable, missing), environ={})


def test_command_targets_the_running_profile(thunderbird):
    assert launcher.launch_command(thunderbird) == [
        thunderbird.executable,
        "--profile",
        thunderbird.profile_dir,
    ]


def test_environment_passes_a_fresh_token_and_drops_a_stale_one():
    base = {"PATH": "/usr/bin", "XDG_ACTIVATION_TOKEN": "stale"}
    assert launcher.launch_environment(base, "fresh")["XDG_ACTIVATION_TOKEN"] == "fresh"
    assert "XDG_ACTIVATION_TOKEN" not in launcher.launch_environment(base, None)
    assert base["XDG_ACTIVATION_TOKEN"] == "stale"


def test_activate_starts_a_detached_process(thunderbird, monkeypatch):
    calls = []
    monkeypatch.setattr(launcher, "can_launch", lambda launch: True)
    monkeypatch.setattr(subprocess, "Popen", lambda *args, **kwargs: calls.append((args, kwargs)))
    assert launcher.activate(thunderbird, "token")
    ((args, kwargs),) = calls
    assert args[0] == launcher.launch_command(thunderbird)
    assert kwargs["env"]["XDG_ACTIVATION_TOKEN"] == "token"
    assert kwargs["start_new_session"] is True
    assert kwargs["stdin"] is subprocess.DEVNULL


def test_activate_reports_failure(thunderbird, monkeypatch):
    def fail(*args, **kwargs):
        raise OSError("boom")

    monkeypatch.setattr(launcher, "can_launch", lambda launch: True)
    monkeypatch.setattr(subprocess, "Popen", fail)
    assert not launcher.activate(thunderbird)


def test_activate_refuses_when_it_cannot_launch(monkeypatch):
    monkeypatch.setattr(subprocess, "Popen", lambda *a, **k: pytest.fail("must not launch"))
    assert not launcher.activate(None)
