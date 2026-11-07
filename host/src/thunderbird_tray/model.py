"""What the extension reports, parsed defensively, and the text shown for it.

Everything here comes from Thunderbird, and message subjects and senders come
from whoever sent the mail, so nothing is trusted to be well formed.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

QUOTA_WARNING_PERCENT = 80
MENU_TEXT_LENGTH = 60
BADGE_LIMIT = 99

DEFAULT_LABELS: dict[str, str] = {
    "trayTitle": "Thunderbird",
    "unreadSummary": "{count} unread",
    "newSummary": "{count} new",
    "noUnread": "No unread messages",
    "quotaWarning": "{account}: mailbox {percent}% full",
    "offlineNotice": "Working offline",
    "mutedNotice": "New mail alerts are off",
    "menuShow": "Show Thunderbird",
    "menuHide": "Hide Thunderbird",
    "menuRecent": "Recent unread",
    "noSubject": "(no subject)",
    "menuCompose": "Write a Message",
    "menuGetMail": "Get New Messages",
    "menuAddressBook": "Address Book",
    "menuCalendar": "Calendar",
    "menuTasks": "Tasks",
    "menuMuted": "Do Not Disturb",
    "menuOffline": "Work Offline",
    "menuSettings": "Tray Settings…",
    "menuQuit": "Quit Thunderbird",
}


@dataclass(frozen=True)
class LaunchInfo:
    executable: str
    profile_dir: str


@dataclass(frozen=True)
class Hello:
    version: str
    launch: LaunchInfo | None
    labels: dict[str, str]


@dataclass(frozen=True)
class Account:
    name: str
    unread: int
    quota_percent: int | None


@dataclass(frozen=True)
class RecentMessage:
    id: int
    author: str
    subject: str
    date: datetime | None
    account: str


@dataclass(frozen=True)
class WindowState:
    hidden: bool = False
    active: bool = False
    muted: bool = False
    offline: bool = False


@dataclass(frozen=True)
class TrayState:
    unread: int = 0
    new_messages: int = 0
    accounts: tuple[Account, ...] = ()
    recent: tuple[RecentMessage, ...] = ()
    window: WindowState = field(default_factory=WindowState)
    show_badge: bool = True
    middle_click: str = "compose"


def _int(value: Any, default: int = 0) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        return default
    return max(value, 0)


def _str(value: Any) -> str:
    return value if isinstance(value, str) else ""


def _bool(value: Any, default: bool = False) -> bool:
    return value if isinstance(value, bool) else default


def _list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _date(value: Any) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def parse_hello(message: dict[str, Any]) -> Hello:
    launch_raw = _dict(message.get("launch"))
    executable = _str(launch_raw.get("executable"))
    profile_dir = _str(launch_raw.get("profileDir"))
    launch = LaunchInfo(executable, profile_dir) if executable and profile_dir else None
    labels = dict(DEFAULT_LABELS)
    for key, value in _dict(message.get("labels")).items():
        if key in labels and isinstance(value, str) and value:
            labels[key] = value
    return Hello(version=_str(message.get("version")), launch=launch, labels=labels)


def parse_window(raw: Any) -> WindowState:
    data = _dict(raw)
    return WindowState(
        hidden=_bool(data.get("hidden")),
        active=_bool(data.get("active")),
        muted=_bool(data.get("muted")),
        offline=_bool(data.get("offline")),
    )


def parse_state(message: dict[str, Any]) -> TrayState:
    accounts = tuple(
        Account(
            name=_str(item.get("name")),
            unread=_int(item.get("unread")),
            quota_percent=(
                _int(item.get("quotaPercent")) if item.get("quotaPercent") is not None else None
            ),
        )
        for item in map(_dict, _list(message.get("accounts")))
    )
    recent = tuple(
        RecentMessage(
            id=item["id"],
            author=_str(item.get("author")),
            subject=_str(item.get("subject")),
            date=_date(item.get("date")),
            account=_str(item.get("account")),
        )
        for item in map(_dict, _list(message.get("recent")))
        if isinstance(item.get("id"), int) and not isinstance(item.get("id"), bool)
    )
    settings = _dict(message.get("settings"))
    middle_click = _str(settings.get("middleClick"))
    return TrayState(
        unread=_int(message.get("unread")),
        new_messages=_int(message.get("newMessages")),
        accounts=accounts,
        recent=recent,
        window=parse_window(message.get("window")),
        show_badge=_bool(settings.get("showBadge"), True),
        middle_click=middle_click if middle_click in ("compose", "getMail", "none") else "compose",
    )


def badge_text(count: int) -> str:
    return f"{BADGE_LIMIT}+" if count > BADGE_LIMIT else str(count)


def fill(template: str, **values: object) -> str:
    """Fills {placeholders} without str.format, which would choke on stray braces."""
    for key, value in values.items():
        template = template.replace("{" + key + "}", str(value))
    return template


def elide(text: str, length: int = MENU_TEXT_LENGTH) -> str:
    flat = " ".join(text.split())
    return flat if len(flat) <= length else flat[: length - 1].rstrip() + "…"


def menu_text(text: str) -> str:
    """Escapes '&', which Qt menus would otherwise read as a keyboard accelerator."""
    return text.replace("&", "&&")


def recent_label(message: RecentMessage, labels: dict[str, str]) -> str:
    subject = message.subject or labels["noSubject"]
    text = f"{message.author} — {subject}" if message.author else subject
    return menu_text(elide(text))


def tooltip_lines(state: TrayState, labels: dict[str, str]) -> list[str]:
    """Plain text lines for the tooltip body, most important first."""
    lines: list[str] = []
    if state.unread:
        summary = fill(labels["unreadSummary"], count=state.unread)
        if state.new_messages:
            summary += " · " + fill(labels["newSummary"], count=state.new_messages)
        lines.append(summary)
        with_unread = [account for account in state.accounts if account.unread]
        if len(with_unread) > 1:
            lines.extend(f"{account.name}: {account.unread}" for account in with_unread)
    else:
        lines.append(labels["noUnread"])
    for account in state.accounts:
        if account.quota_percent is not None and account.quota_percent >= QUOTA_WARNING_PERCENT:
            lines.append(
                fill(labels["quotaWarning"], account=account.name, percent=account.quota_percent)
            )
    if state.window.offline:
        lines.append(labels["offlineNotice"])
    if state.window.muted:
        lines.append(labels["mutedNotice"])
    return lines


def tooltip_text(state: TrayState, labels: dict[str, str]) -> str:
    return "\n".join([labels["trayTitle"], *tooltip_lines(state, labels)])
