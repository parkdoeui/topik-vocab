"""Keep Railway's PostgreSQL URL on the driver declared in requirements.txt."""

import os
import subprocess
import sys
import unittest


class DatabaseDriverTests(unittest.TestCase):
    def test_both_postgres_url_forms_select_psycopg2(self) -> None:
        for scheme in ("postgres://", "postgresql://"):
            with self.subTest(scheme=scheme):
                environment = {
                    **os.environ,
                    "DATABASE_URL": scheme + "sample:sample@localhost/sample",
                    "VALID_PASSCODE": "database-driver-test",
                }
                result = subprocess.run(
                    [sys.executable, "-c", "import database; print(database.engine.dialect.driver)"],
                    env=environment, capture_output=True, text=True, check=True,
                )
                self.assertEqual(result.stdout.strip(), "psycopg2")
