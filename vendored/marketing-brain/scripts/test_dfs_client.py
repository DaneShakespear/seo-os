from __future__ import annotations

import hashlib
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import _dfs_client as dfs


class DataForSEOReceiptTest(unittest.TestCase):
    def test_raw_response_has_a_hashed_request_receipt(self) -> None:
        payload = [{
            "keyword": "las vegas limo service",
            "location_name": "Las Vegas, Nevada, United States",
            "language_code": "en",
        }]
        response = {
            "status_code": 20000,
            "status_message": "Ok.",
            "cost": 0.0006,
            "tasks": [],
        }
        with tempfile.TemporaryDirectory() as tmp:
            raw_path = Path(tmp) / "serp.json"
            with patch.dict(os.environ, {
                "DATAFORSEO_LOGIN": "test-login",
                "DATAFORSEO_PASSWORD": "test-password",
            }), patch.object(dfs, "_post_with_retry", return_value=response):
                dfs.reset_total()
                dfs.call("/v3/serp/google/organic/live/regular", payload, "test", raw_path)

            raw_text = raw_path.read_text(encoding="utf-8")
            receipt = json.loads(
                raw_path.with_suffix(".json.meta.json").read_text(encoding="utf-8")
            )
            request_text = json.dumps(payload, sort_keys=True, separators=(",", ":"))
            self.assertEqual(receipt["provider"], "DataForSEO")
            self.assertEqual(receipt["request"], payload)
            self.assertEqual(
                receipt["request_sha256"],
                hashlib.sha256(request_text.encode("utf-8")).hexdigest(),
            )
            self.assertEqual(
                receipt["response_sha256"],
                hashlib.sha256(raw_text.encode("utf-8")).hexdigest(),
            )
            self.assertNotIn("test-password", json.dumps(receipt))


if __name__ == "__main__":
    unittest.main()
