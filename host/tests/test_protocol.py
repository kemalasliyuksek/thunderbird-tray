import io
import struct

import pytest

from thunderbird_tray.protocol import (
    MAX_INCOMING,
    MAX_OUTGOING,
    ProtocolError,
    encode_message,
    read_message,
    write_message,
)


def frame(body: bytes) -> bytes:
    return struct.pack("=I", len(body)) + body


class Trickle(io.RawIOBase):
    """A stream that returns at most a few bytes per read, like a pipe can."""

    def __init__(self, data: bytes, step: int = 3) -> None:
        self._data = data
        self._step = step

    def readable(self) -> bool:
        return True

    def read(self, size: int = -1) -> bytes:
        chunk, self._data = self._data[: min(size, self._step)], self._data[min(size, self._step) :]
        return chunk


def test_round_trip_keeps_unicode():
    stream = io.BytesIO()
    message = {"type": "state", "subject": "Çay & simit 🍵"}
    write_message(stream, message)
    stream.seek(0)
    assert read_message(stream) == message
    assert read_message(stream) is None


def test_reads_several_messages_in_a_row():
    stream = io.BytesIO(frame(b'{"a":1}') + frame(b"[2]") + frame(b'"three"'))
    assert [read_message(stream) for _ in range(4)] == [{"a": 1}, [2], "three", None]


def test_reads_across_short_reads():
    assert read_message(Trickle(frame(b'{"long":"' + b"x" * 50 + b'"}'))) == {"long": "x" * 50}


def test_clean_end_of_stream_is_none():
    assert read_message(io.BytesIO(b"")) is None


@pytest.mark.parametrize(
    "data",
    [
        b"\x05\x00",  # truncated length
        frame(b'{"a":1}')[:-2],  # truncated body
    ],
)
def test_truncated_frames_are_errors(data):
    with pytest.raises(ProtocolError, match="ended"):
        read_message(io.BytesIO(data))


def test_invalid_json_is_an_error():
    with pytest.raises(ProtocolError, match="JSON"):
        read_message(io.BytesIO(frame(b"{nope")))


def test_invalid_utf8_is_an_error():
    with pytest.raises(ProtocolError, match="JSON"):
        read_message(io.BytesIO(frame(b'"\xff"')))


def test_oversized_incoming_length_is_rejected_before_reading():
    with pytest.raises(ProtocolError, match="too large"):
        read_message(io.BytesIO(struct.pack("=I", MAX_INCOMING + 1)))


def test_oversized_outgoing_message_is_rejected():
    with pytest.raises(ProtocolError, match="too large"):
        encode_message({"blob": "x" * MAX_OUTGOING})


def test_encoding_uses_native_byte_order_length():
    encoded = encode_message({"type": "ready"})
    (length,) = struct.unpack("=I", encoded[:4])
    assert encoded[4:] == b'{"type":"ready"}'
    assert length == len(encoded) - 4
