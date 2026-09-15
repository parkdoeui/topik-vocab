"""Helpers for transporting the access code through ASCII-only HTTP fields."""
from __future__ import annotations

import base64
import binascii

_TRANSPORT_PREFIX = "v1."


def encode_passcode_for_transport(passcode: str) -> str:
    """Encode a Unicode passcode as an unpadded, URL-safe Base64 token."""
    encoded = base64.urlsafe_b64encode(passcode.encode("utf-8")).decode("ascii")
    return f"{_TRANSPORT_PREFIX}{encoded.rstrip('=')}"


def decode_passcode_from_transport(value: str) -> str | None:
    """Decode a transport token, returning ``None`` when it is malformed."""
    if not value.startswith(_TRANSPORT_PREFIX):
        return None

    encoded = value[len(_TRANSPORT_PREFIX):]
    encoded += "=" * (-len(encoded) % 4)
    try:
        return base64.b64decode(encoded, altchars=b"-_", validate=True).decode("utf-8")
    except (binascii.Error, UnicodeDecodeError, ValueError):
        return None


def passcode_matches_transport(value: str | None, expected: str) -> bool:
    """Accept the encoded format plus legacy raw ASCII values during rollout."""
    if value is None:
        return False
    return value == expected or decode_passcode_from_transport(value) == expected
