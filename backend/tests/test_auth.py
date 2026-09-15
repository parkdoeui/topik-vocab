import unittest

from starlette.responses import Response

from auth import (
    decode_passcode_from_transport,
    encode_passcode_for_transport,
    passcode_matches_transport,
)


class PasscodeTransportTests(unittest.TestCase):
    def test_unicode_passcode_round_trip_uses_ascii_only(self) -> None:
        passcode = "topik-한글-🔒"

        encoded = encode_passcode_for_transport(passcode)

        self.assertEqual(encoded, "v1.dG9waWst7ZWc6riALfCflJI")
        self.assertTrue(encoded.isascii())
        self.assertEqual(decode_passcode_from_transport(encoded), passcode)
        self.assertTrue(passcode_matches_transport(encoded, passcode))

    def test_encoded_unicode_passcode_is_safe_in_cookie_header(self) -> None:
        response = Response()

        response.set_cookie("topik_passcode", encode_passcode_for_transport("한글-🔒"))

        cookie_header = dict(response.raw_headers)[b"set-cookie"]
        self.assertTrue(cookie_header.isascii())

    def test_legacy_raw_passcode_still_matches(self) -> None:
        self.assertTrue(passcode_matches_transport("legacy-ascii", "legacy-ascii"))

    def test_malformed_token_does_not_match(self) -> None:
        self.assertIsNone(decode_passcode_from_transport("v1.%%%"))
        self.assertFalse(passcode_matches_transport("v1.%%%", "anything"))


if __name__ == "__main__":
    unittest.main()
