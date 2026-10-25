"""Synthetic documentary fixtures; never provider revocation evidence."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


spec = importlib.util.spec_from_file_location("incident_attestation", Path(__file__).with_name("incident-attestation.py"))
attestation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(attestation)


def synthetic_completed_record():
    record = {key: True for key in attestation.BOOL_FIELDS}
    record.update({"schema_version": attestation.SCHEMA, "incident_id": attestation.INCIDENT,
                   "attestor_reference": "SYNTHETIC_OWNER_ONLY", "attested_at": "2026-10-25T10:00:00+07:00",
                   "revoked_at": "2026-10-25T09:00:00+07:00", "replacement_status": "PROVISIONED_SERVER_SIDE",
                   "evidence_ticket_reference": "SYNTHETIC_TICKET_ONLY"})
    return record


class IncidentAttestationTest(unittest.TestCase):
    def test_complete_owner_claims_cannot_close_or_provider_verify_incident(self):
        result = attestation.validate(synthetic_completed_record())
        self.assertTrue(result["owner_claims_complete"])
        self.assertFalse(result["provider_revocation_verified"])
        self.assertFalse(result["incident_closure_authorized"])
        self.assertNotIn("SYNTHETIC_OWNER_ONLY", json.dumps(result))

    def test_unfilled_template_cannot_become_closure_evidence(self):
        path = Path(__file__).parents[1] / "docs/validation/phase3-security-owner-attestation.template.json"
        result = attestation.check_file(path)
        self.assertFalse(result["owner_claims_complete"])
        self.assertIn("exposed_credential_revoked", result["missing_owner_claims"])

    def test_revocation_claim_requires_timestamp_and_rejects_bad_chronology(self):
        record = synthetic_completed_record()
        record["revoked_at"] = None
        self.assertIn("revoked_at", attestation.validate(record)["missing_owner_claims"])
        record["revoked_at"] = "2026-10-25T11:00:00+07:00"
        with self.assertRaises(attestation.InvalidAttestation):
            attestation.validate(record)

    def test_naive_timestamp_string_bool_and_wrong_incident_rejected(self):
        for key, value in [("attested_at", "2026-10-25T10:00:00"),
                           ("exposed_credential_revoked", "true"), ("incident_id", "OTHER_INCIDENT")]:
            record = synthetic_completed_record()
            record[key] = value
            with self.assertRaises(attestation.InvalidAttestation):
                attestation.validate(record)

    def test_unknown_field_duplicate_field_and_secret_values_fail_without_echo(self):
        secret = "sk-" + "Z" * 45  # Fabricated, never authenticated.
        unknown = synthetic_completed_record()
        unknown[secret] = secret
        known = synthetic_completed_record()
        known["evidence_ticket_reference"] = secret
        duplicate = json.dumps(synthetic_completed_record())[:-1] + ',"exposed_credential_revoked":false}'
        for text in [json.dumps(unknown), json.dumps(known), duplicate]:
            with tempfile.TemporaryDirectory() as directory:
                document = Path(directory) / "synthetic.json"
                document.write_text(text)
                result = subprocess.run([sys.executable, "-B", str(Path(__file__).with_name("incident-attestation.py")), str(document)],
                                        capture_output=True, text=True)
                self.assertEqual(result.returncode, 2)
                self.assertNotIn(secret, result.stdout + result.stderr)
                self.assertFalse(json.loads(result.stdout)["incident_closure_authorized"])


if __name__ == "__main__":
    unittest.main()
