"""Minimal MP3 helpers for stitching per-block audio into one file."""
from typing import Iterable, List

_BITRATES = {
    # (version_bits, layer_bits) -> kbps table indexed by bitrate_index
    "v1l3": [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
    "v2l3": [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
}
_SAMPLE_RATES = {3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000]}


def _skip_id3v2(data: bytes) -> bytes:
    if len(data) >= 10 and data[:3] == b"ID3":
        size = (data[6] << 21) | (data[7] << 14) | (data[8] << 7) | data[9]
        footer = 10 if data[5] & 0x10 else 0
        return data[10 + size + footer:]
    return data


def _strip_id3v1(data: bytes) -> bytes:
    if len(data) >= 128 and data[-128:-125] == b"TAG":
        return data[:-128]
    return data


def _first_frame_length(data: bytes) -> int:
    """Length of the MPEG layer III frame at the start of `data`, or 0 if not a frame."""
    if len(data) < 4 or data[0] != 0xFF or (data[1] & 0xE0) != 0xE0:
        return 0
    version = (data[1] >> 3) & 0x03  # 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
    layer = (data[1] >> 1) & 0x03  # 1 = Layer III
    if version == 1 or layer != 1:
        return 0
    bitrate_index = (data[2] >> 4) & 0x0F
    sr_index = (data[2] >> 2) & 0x03
    padding = (data[2] >> 1) & 0x01
    if bitrate_index in (0, 15) or sr_index == 3:
        return 0
    table = _BITRATES["v1l3" if version == 3 else "v2l3"]
    bitrate = table[bitrate_index] * 1000
    sample_rate = _SAMPLE_RATES[version][sr_index]
    coeff = 144 if version == 3 else 72
    return coeff * bitrate // sample_rate + padding


def _strip_vbr_header_frame(data: bytes) -> bytes:
    """Drop a leading Xing/Info/VBRI frame: it describes one block, not the whole file."""
    length = _first_frame_length(data)
    if length and any(tag in data[:length] for tag in (b"Xing", b"Info", b"VBRI")):
        return data[length:]
    return data


def clean_segment(data: bytes) -> bytes:
    return _strip_vbr_header_frame(_strip_id3v1(_skip_id3v2(data)))


def concat_mp3(segments: Iterable[bytes]) -> bytes:
    """
    Concatenate MP3 segments into one stream. Per-segment ID3 tags and VBR header
    frames are removed so players compute the real total duration.
    """
    out: List[bytes] = [clean_segment(seg) for seg in segments if seg]
    return b"".join(out)
