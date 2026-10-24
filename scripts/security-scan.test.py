"""Regression checks for location-only output; all test credentials are fabricated."""
import importlib.util
import json
from pathlib import Path
import unittest
from unittest import mock

spec = importlib.util.spec_from_file_location("security_scan", Path(__file__).with_name("security-scan.py"))
scan = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scan)


class RedactedScanTest(unittest.TestCase):
    def test_multiple_provider_literals_never_reappear(self):
        samples = ["sk-" + "A" * 45, "github_pat_" + "B" * 40,
                   "-----BEGIN " + "PRIVATE KEY-----"]
        report = scan.inspect_text("\n".join(samples), "source.ts")
        encoded = json.dumps(report)
        self.assertEqual([row["line"] for row in report], [1, 2, 3])
        for sample in samples:
            self.assertNotIn(sample, encoded)
        self.assertEqual(set(report[0]), {"path", "line", "kind"})

    def test_public_firebase_config_is_not_reported_as_server_secret(self):
        self.assertEqual(scan.inspect_text('apiKey: "' + "AIza" + "C" * 35 + '"', "config.ts"), [])

    def test_unpinned_or_path_escape_remote_is_rejected_before_read(self):
        with mock.patch.object(scan, "command") as command:
            for ref, path in [("main", "app.ts"), ("a" * 40, "../private"),
                              ("a" * 40, "app.ts?ref=main")]:
                with self.assertRaises(ValueError):
                    scan.github_source("owner/repo", ref, path)
            command.assert_not_called()


if __name__ == "__main__":
    unittest.main()
