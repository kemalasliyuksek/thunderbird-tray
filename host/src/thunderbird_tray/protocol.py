"""Native messaging framing: a 32-bit length in native byte order, then UTF-8 JSON."""

from __future__ import annotations

import json
import struct
from typing import Any, BinaryIO

# Thunderbird refuses messages from a native program larger than 1 MiB.
MAX_OUTGOING = 1024 * 1024
# State messages are a few kilobytes; anything far larger means a broken stream.
MAX_INCOMING = 8 * 1024 * 1024

_LENGTH = struct.Struct("=I")


class ProtocolError(Exception):
    """The stream does not contain a valid native messaging frame."""


def read_message(stream: BinaryIO) -> Any | None:
    """Reads one message, or returns None when the stream ends cleanly."""
    header = _read_exactly(stream, _LENGTH.size, allow_eof=True)
    if header is None:
        return None
    (length,) = _LENGTH.unpack(header)
    if length > MAX_INCOMING:
        raise ProtocolError(f"incoming message of {length} bytes is too large")
    body = _read_exactly(stream, length, allow_eof=False)
    try:
        return json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ProtocolError(f"incoming message is not valid JSON: {error}") from error


def encode_message(message: Any) -> bytes:
    body = json.dumps(message, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if len(body) > MAX_OUTGOING:
        raise ProtocolError(f"outgoing message of {len(body)} bytes is too large")
    return _LENGTH.pack(len(body)) + body


def write_message(stream: BinaryIO, message: Any) -> None:
    stream.write(encode_message(message))
    stream.flush()


def _read_exactly(stream: BinaryIO, size: int, *, allow_eof: bool) -> bytes | None:
    chunks = []
    remaining = size
    while remaining > 0:
        chunk = stream.read(remaining)
        if not chunk:
            if allow_eof and remaining == size:
                return None
            raise ProtocolError("stream ended in the middle of a message")
        chunks.append(chunk)
        remaining -= len(chunk)
    return b"".join(chunks)
