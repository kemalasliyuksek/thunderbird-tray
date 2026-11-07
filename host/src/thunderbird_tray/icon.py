"""The tray icon: Thunderbird's own icon, with an unread badge when needed."""

from __future__ import annotations

from pathlib import Path

from PyQt6.QtCore import QRectF, QSize, Qt
from PyQt6.QtGui import QColor, QFont, QIcon, QImage, QPainter, QPainterPath, QPen, QPixmap

from .model import badge_text

SIZES = (16, 22, 24, 32, 48, 64, 128)
THEME_NAMES = ("thunderbird", "net.thunderbird.Thunderbird", "org.mozilla.Thunderbird")
ICON_DIRS = (Path("/usr/share/icons/hicolor"), Path.home() / ".local/share/icons/hicolor")

BADGE_FILL = QColor("#e5322d")
BADGE_OUTLINE = QColor("#ffffff")
BADGE_TEXT = QColor("#ffffff")


def load_base_icon() -> QIcon:
    """Thunderbird's icon from the icon theme, or a drawn envelope if none is found."""
    for name in THEME_NAMES:
        icon = QIcon.fromTheme(name)
        if not icon.isNull():
            return icon
    icon = QIcon()
    for directory in ICON_DIRS:
        for name in THEME_NAMES:
            for path in sorted(directory.glob(f"*/apps/{name}.png")):
                icon.addFile(str(path))
            svg = directory / "scalable/apps" / f"{name}.svg"
            if svg.is_file():
                icon.addFile(str(svg))
    if not icon.isNull() and icon.availableSizes():
        return icon
    return envelope_icon()


def envelope_icon() -> QIcon:
    icon = QIcon()
    for size in SIZES:
        pixmap = QPixmap(size, size)
        pixmap.fill(Qt.GlobalColor.transparent)
        painter = QPainter(pixmap)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        margin = size * 0.1
        body = QRectF(margin, size * 0.22, size - 2 * margin, size * 0.56)
        painter.setPen(QPen(QColor("#1a56b8"), max(1.0, size / 16)))
        painter.setBrush(QColor("#ffffff"))
        painter.drawRoundedRect(body, size * 0.08, size * 0.08)
        flap = QPainterPath()
        flap.moveTo(body.left(), body.top())
        flap.lineTo(body.center().x(), body.top() + body.height() * 0.55)
        flap.lineTo(body.right(), body.top())
        painter.setBrush(Qt.BrushStyle.NoBrush)
        painter.drawPath(flap)
        painter.end()
        icon.addPixmap(pixmap)
    return icon


def _grayscale(pixmap: QPixmap) -> QPixmap:
    image = pixmap.toImage().convertToFormat(QImage.Format.Format_ARGB32)
    for y in range(image.height()):
        for x in range(image.width()):
            color = image.pixelColor(x, y)
            gray = int(color.red() * 0.3 + color.green() * 0.59 + color.blue() * 0.11)
            image.setPixelColor(x, y, QColor(gray, gray, gray, color.alpha() // 2 + 40))
    return QPixmap.fromImage(image)


def _draw_badge(painter: QPainter, size: int, text: str) -> None:
    font = QFont()
    font.setBold(True)
    font.setPixelSize(max(7, round(size * 0.42)))
    painter.setFont(font)
    metrics = painter.fontMetrics()
    height = max(9.0, size * 0.56)
    width = max(height, metrics.horizontalAdvance(text) + height * 0.45)
    width = min(width, float(size))
    rect = QRectF(size - width, 0, width, height)
    outline = max(1.0, size / 20)
    painter.setPen(QPen(BADGE_OUTLINE, outline))
    painter.setBrush(BADGE_FILL)
    radius = height / 2
    inset = outline / 2
    painter.drawRoundedRect(rect.adjusted(inset, inset, -inset, -inset), radius, radius)
    painter.setPen(BADGE_TEXT)
    painter.drawText(rect, Qt.AlignmentFlag.AlignCenter, text)


def render_icon(base: QIcon, *, unread: int, show_badge: bool, offline: bool) -> QIcon:
    icon = QIcon()
    for size in SIZES:
        # Exact device pixels: on a scaled screen pixmap(size, size) returns a
        # larger image marked as high-DPI, which a plain canvas would draw at
        # half size. The tray picks the best of these sizes itself.
        pixmap = base.pixmap(QSize(size, size), 1.0)
        if pixmap.isNull():
            continue
        pixmap.setDevicePixelRatio(1.0)
        if pixmap.width() != size:
            pixmap = pixmap.scaled(
                size,
                size,
                Qt.AspectRatioMode.KeepAspectRatio,
                Qt.TransformationMode.SmoothTransformation,
            )
        if offline:
            pixmap = _grayscale(pixmap)
        if show_badge and unread > 0:
            canvas = QPixmap(size, size)
            canvas.fill(Qt.GlobalColor.transparent)
            painter = QPainter(canvas)
            painter.setRenderHint(QPainter.RenderHint.Antialiasing)
            painter.setRenderHint(QPainter.RenderHint.TextAntialiasing)
            painter.drawPixmap(0, 0, pixmap)
            _draw_badge(painter, size, badge_text(unread))
            painter.end()
            pixmap = canvas
        icon.addPixmap(pixmap)
    return icon
