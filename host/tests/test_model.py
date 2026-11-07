from datetime import UTC, datetime

from thunderbird_tray.model import (
    DEFAULT_LABELS,
    Account,
    RecentMessage,
    TrayState,
    WindowState,
    badge_text,
    elide,
    fill,
    menu_text,
    parse_hello,
    parse_state,
    recent_label,
    tooltip_text,
)


def test_parse_state_reads_a_full_message():
    state = parse_state(
        {
            "type": "state",
            "unread": 7,
            "newMessages": 2,
            "accounts": [
                {"id": "a1", "name": "Personal", "unread": 5, "quotaPercent": 91},
                {"id": "a2", "name": "Work", "unread": 2, "quotaPercent": None},
            ],
            "recent": [
                {
                    "id": 12,
                    "author": "Ada",
                    "subject": "Notes",
                    "date": "2026-11-07T10:00:00.000Z",
                    "account": "Personal",
                }
            ],
            "window": {"hidden": True, "active": False, "muted": True, "offline": False},
            "settings": {"showBadge": False, "middleClick": "getMail"},
        }
    )
    assert state.unread == 7
    assert state.new_messages == 2
    assert state.accounts == (Account("Personal", 5, 91), Account("Work", 2, None))
    assert state.recent == (
        RecentMessage(12, "Ada", "Notes", datetime(2026, 11, 7, 10, tzinfo=UTC), "Personal"),
    )
    assert state.window == WindowState(hidden=True, active=False, muted=True, offline=False)
    assert state.show_badge is False
    assert state.middle_click == "getMail"


def test_parse_state_survives_garbage():
    state = parse_state(
        {
            "unread": "lots",
            "newMessages": -3,
            "accounts": "none",
            "recent": [
                {"id": "x"},
                {"id": True},
                "nope",
                {"id": 4, "date": "yesterday", "author": 5},
            ],
            "window": None,
            "settings": {"middleClick": "rm -rf"},
        }
    )
    assert state.unread == 0
    assert state.new_messages == 0
    assert state.accounts == ()
    assert state.recent == (RecentMessage(4, "", "", None, ""),)
    assert state.window == WindowState()
    assert state.middle_click == "compose"
    assert state.show_badge is True


def test_parse_hello_keeps_known_labels_only():
    hello = parse_hello(
        {
            "version": "0.1.0",
            "launch": {"executable": "/usr/bin/thunderbird", "profileDir": "/p"},
            "labels": {"menuQuit": "Çık", "evil": "x", "menuShow": "", "menuHide": 3},
        }
    )
    assert hello.version == "0.1.0"
    assert hello.launch is not None
    assert hello.launch.executable == "/usr/bin/thunderbird"
    assert hello.labels["menuQuit"] == "Çık"
    assert "evil" not in hello.labels
    assert hello.labels["menuShow"] == DEFAULT_LABELS["menuShow"]
    assert hello.labels["menuHide"] == DEFAULT_LABELS["menuHide"]


def test_parse_hello_without_launch_info():
    assert parse_hello({"launch": {"executable": "/x"}}).launch is None
    assert parse_hello({}).launch is None


def test_badge_text_caps_large_counts():
    assert badge_text(1) == "1"
    assert badge_text(99) == "99"
    assert badge_text(100) == "99+"


def test_fill_tolerates_stray_braces():
    assert fill("{count} unread {oops}", count=3) == "3 unread {oops}"
    assert fill("%{percent} dolu", percent=91) == "%91 dolu"


def test_menu_text_escapes_accelerators():
    assert menu_text("Tom & Jerry") == "Tom && Jerry"


def test_elide_flattens_and_shortens():
    assert elide("a\n  b") == "a b"
    assert elide("x" * 100, 10) == "x" * 9 + "…"


def test_recent_label_handles_missing_parts():
    labels = DEFAULT_LABELS
    message = RecentMessage(1, "Ada", "", None, "")
    assert recent_label(message, labels) == "Ada — (no subject)"
    assert recent_label(RecentMessage(1, "", "Hi & bye", None, ""), labels) == "Hi && bye"


def test_tooltip_lists_accounts_only_when_more_than_one_has_mail():
    single = TrayState(unread=3, accounts=(Account("Personal", 3, None), Account("Work", 0, None)))
    assert tooltip_text(single, DEFAULT_LABELS) == "Thunderbird\n3 unread"

    both = TrayState(
        unread=5,
        new_messages=1,
        accounts=(Account("Personal", 3, None), Account("Work", 2, None)),
    )
    assert tooltip_text(both, DEFAULT_LABELS) == (
        "Thunderbird\n5 unread · 1 new\nPersonal: 3\nWork: 2"
    )


def test_tooltip_reports_quota_offline_and_muted():
    state = TrayState(
        accounts=(Account("Work", 0, 85), Account("Personal", 0, 40)),
        window=WindowState(offline=True, muted=True),
    )
    assert tooltip_text(state, DEFAULT_LABELS).splitlines() == [
        "Thunderbird",
        "No unread messages",
        "Work: mailbox 85% full",
        "Working offline",
        "New mail alerts are off",
    ]
