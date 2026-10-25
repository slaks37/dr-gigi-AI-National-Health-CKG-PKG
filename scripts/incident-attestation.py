#!/usr/bin/env python3
"""Validate nonsecret owner incident documentation; never contact the provider.

Exit 0: required owner statements present, still NOT provider-verified or closed.
Exit 1: well-formed template/document lacks required owner statements.
Exit 2: invalid document. Output never includes submitted values or exceptions.
"""
import argparse
from datetime import datetime
import json
from pathlib import Path
import re
import sys


SCHEMA = "sonri.incident-owner-attestation.v1"
INCIDENT = "SONRI-SUPPORTING-SOURCE-EXPOSURE-20261024"
BOOL_FIELDS = {
    "exposed_credential_revoked", "provider_usage_review_completed",
    "affected_source_and_bundle_cleanup_completed", "history_and_cache_exposure_assessed",
}
FIELDS = BOOL_FIELDS | {
    "schema_version", "incident_id", "attestor_reference", "attested_at",
    "revoked_at", "replacement_status", "evidence_ticket_reference",
}
SECRET_PATTERN = re.compile(
    r"(?:\bsk-[A-Za-z0-9_-]{20,}|\bgh[pousr]_[A-Za-z0-9]{30,}|"
    r"\bgithub_pat_[A-Za-z0-9_]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)"
)
REFERENCE = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}")


class InvalidAttestation(ValueError):
    """Deliberately carries no submitted source or field values."""


def unique_pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise InvalidAttestation()
        result[key] = value
    return result


def timestamp(value):
    if value is None:
        return None
    if not isinstance(value, str):
        raise InvalidAttestation()
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise InvalidAttestation() from None
    if result.tzinfo is None or result.utcoffset() is None:
        raise InvalidAttestation()
    return result


def validate(record):
    if not isinstance(record, dict) or set(record) != FIELDS:
        raise InvalidAttestation()
    if record["schema_version"] != SCHEMA or record["incident_id"] != INCIDENT:
        raise InvalidAttestation()
    for value in record.values():
        if isinstance(value, str) and SECRET_PATTERN.search(value):
            raise InvalidAttestation()
    for key in BOOL_FIELDS:
        if type(record[key]) is not bool:
            raise InvalidAttestation()
    for key in ["attestor_reference", "evidence_ticket_reference"]:
        value = record[key]
        if value is not None and (not isinstance(value, str) or not REFERENCE.fullmatch(value)):
            raise InvalidAttestation()
    if record["replacement_status"] not in {"PENDING", "NOT_REQUIRED", "PROVISIONED_SERVER_SIDE"}:
        raise InvalidAttestation()
    attested = timestamp(record["attested_at"])
    revoked = timestamp(record["revoked_at"])
    if revoked and not record["exposed_credential_revoked"]:
        raise InvalidAttestation()
    if revoked and attested and revoked > attested:
        raise InvalidAttestation()
    missing = sorted(key for key in BOOL_FIELDS if not record[key])
    for key in ["attestor_reference", "evidence_ticket_reference", "attested_at"]:
        if record[key] is None:
            missing.append(key)
    if record["exposed_credential_revoked"] and revoked is None:
        missing.append("revoked_at")
    if record["replacement_status"] == "PENDING":
        missing.append("replacement_status")
    complete = not missing
    return {
        "schema_version": "sonri.incident-attestation-check.v1",
        "status": "OWNER_ATTESTATION_COMPLETE_NOT_PROVIDER_VERIFIED" if complete else "OWNER_DOCUMENTATION_INCOMPLETE",
        "owner_claims_complete": complete, "missing_owner_claims": sorted(missing),
        "provider_revocation_verified": False, "incident_closure_authorized": False,
        "clinical_rollout_authorized": False, "network_or_provider_calls": False,
        "submitted_values_emitted": False,
    }


def check_file(path):
    if path.is_symlink() or not path.is_file() or path.stat().st_size > 65_536:
        raise InvalidAttestation()
    record = json.loads(path.read_text(), object_pairs_hook=unique_pairs)
    return validate(record)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("document", type=Path)
    args = parser.parse_args()
    try:
        report = check_file(args.document)
        print(json.dumps(report, indent=2))
        return 0 if report["owner_claims_complete"] else 1
    except Exception:
        print(json.dumps({"error": "INVALID_OR_UNREADABLE_ATTESTATION", "submitted_values_emitted": False,
                          "provider_revocation_verified": False, "incident_closure_authorized": False}))
        return 2


if __name__ == "__main__":
    sys.exit(main())
