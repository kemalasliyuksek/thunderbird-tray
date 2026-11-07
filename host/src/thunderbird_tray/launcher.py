"""Brings Thunderbird's window to the front by launching Thunderbird again.

On Wayland a window may only take the focus with an activation token from the
compositor. A second Thunderbird process hands its command line, and a token,
to the running one and exits; the running one then focuses its main window,
which the extension turns into "show the hidden window". This is the same path
a click on Thunderbird's launcher takes.
"""

from __future__ import annotations

import logging
import os
import subprocess
from collections.abc import Mapping
from pathlib import Path

from .model import LaunchInfo

log = logging.getLogger(__name__)

# Set when Thunderbird runs with --no-remote. A second process would then not
# reach the running one and would complain that the profile is in use.
_NO_REMOTE_VARIABLES = ("MOZ_NO_REMOTE", "MOZ_NEW_INSTANCE")


def can_launch(launch: LaunchInfo | None, environ: Mapping[str, str] = os.environ) -> bool:
    if launch is None:
        return False
    if any(environ.get(name) for name in _NO_REMOTE_VARIABLES):
        return False
    executable = Path(launch.executable)
    return (
        executable.is_absolute()
        and executable.is_file()
        and os.access(executable, os.X_OK)
        and Path(launch.profile_dir).is_dir()
    )


def launch_command(launch: LaunchInfo) -> list[str]:
    return [launch.executable, "--profile", launch.profile_dir]


def launch_environment(environ: Mapping[str, str], activation_token: str | None) -> dict[str, str]:
    env = dict(environ)
    if activation_token:
        env["XDG_ACTIVATION_TOKEN"] = activation_token
    else:
        # A token inherited from Thunderbird's own start is already used up.
        env.pop("XDG_ACTIVATION_TOKEN", None)
    return env


def activate(launch: LaunchInfo | None, activation_token: str | None = None) -> bool:
    """Starts the hand-off and returns False if it could not be started."""
    if not can_launch(launch):
        return False
    assert launch is not None
    try:
        subprocess.Popen(
            launch_command(launch),
            env=launch_environment(os.environ, activation_token),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
    except OSError as error:
        log.warning("could not launch Thunderbird to raise its window: %s", error)
        return False
    return True
