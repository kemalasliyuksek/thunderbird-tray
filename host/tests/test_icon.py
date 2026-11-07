import os

import pytest

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
# Like a scaled desktop, where QIcon.pixmap() hands out high-DPI pixmaps.
os.environ.setdefault("QT_SCALE_FACTOR", "2")

from PyQt6.QtCore import QSize
from PyQt6.QtGui import QColor, QGuiApplication

from thunderbird_tray.icon import SIZES, envelope_icon, render_icon


@pytest.fixture(scope="module", autouse=True)
def app():
    return QGuiApplication.instance() or QGuiApplication([])


def pixel(icon, size, x, y) -> QColor:
    image = icon.pixmap(QSize(size, size), 1.0).toImage()
    return image.pixelColor(x, y)


def test_every_size_is_rendered_at_full_pixel_size():
    icon = render_icon(envelope_icon(), unread=3, show_badge=True, offline=False)
    assert sorted(size.width() for size in icon.availableSizes()) == sorted(SIZES)
    for size in SIZES:
        pixmap = icon.pixmap(QSize(size, size), 1.0)
        assert (pixmap.width(), pixmap.height()) == (size, size)


def test_high_dpi_base_icon_is_not_shrunk():
    # Regression: drawing a 2x pixmap onto a 1x canvas halved the logo.
    base = envelope_icon()
    plain = render_icon(base, unread=0, show_badge=True, offline=False)
    badged = render_icon(base, unread=3, show_badge=True, offline=False)
    # The envelope reaches the lower left corner area in both.
    assert pixel(plain, 48, 8, 34).alpha() > 0
    assert pixel(badged, 48, 8, 34).alpha() > 0


def test_badge_is_drawn_in_the_top_right_corner():
    badged = render_icon(envelope_icon(), unread=5, show_badge=True, offline=False)
    color = pixel(badged, 48, 40, 8)
    assert color.red() > 180 and color.green() < 100 and color.blue() < 100


def test_no_badge_without_unread_or_when_turned_off():
    for unread, show in ((0, True), (5, False)):
        icon = render_icon(envelope_icon(), unread=unread, show_badge=show, offline=False)
        color = pixel(icon, 48, 44, 2)
        assert not (color.alpha() > 0 and color.red() > 180 and color.green() < 100)


def test_offline_icon_is_gray():
    icon = render_icon(envelope_icon(), unread=0, show_badge=True, offline=True)
    image = icon.pixmap(QSize(48, 48), 1.0).toImage()
    for y in range(0, 48, 4):
        for x in range(0, 48, 4):
            color = image.pixelColor(x, y)
            if color.alpha():
                assert color.red() == color.green() == color.blue()
