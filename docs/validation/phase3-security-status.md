# Phase 3 — incident remains OPEN / AWAITING_OWNER_ATTESTATION

Recorded 2026-10-25 (Asia/Jakarta). The owner subsequently requested the source/removal link on 2026-10-25; no completed revocation/rotation was stated. The earlier deferral is preserved as incident history. No new nonsecret revocation/rotation attestation was found in the incident/operations documentation available to this run. **Provider revocation, replacement provisioning, source/bundle cleanup and usage review remain unverified.** See [status record](phase3-security-status.v1.json) and [existing incident](security-incident.md).

The exposed key and its source were not read, refetched, copied, used or tested during this Phase 3 check. No provider account action was attempted. A link request or source deletion does not close the incident, revoke the provider key, or authorize reuse. Independent synthetic staging with separate credentials may continue; clinical rollout remains prohibited.

The owner can privately complete a copy of [the nonsecret attestation template](phase3-security-owner-attestation.template.json) after actually performing the actions. Use opaque owner/ticket references and timezone-qualified timestamps. Include no API key, provider log payload, account identifier, patient information or secret fingerprint. `replacement_status` accepts `PENDING`, `NOT_REQUIRED` or `PROVISIONED_SERVER_SIDE`; a replacement is not needed if the affected integration is retired.

```sh
python3 -B scripts/incident-attestation.test.py
python3 -B scripts/incident-attestation.py /private/nonsecret-owner-attestation.json
```

The validator checks the incident identity, strict field types, revocation chronology, duplicate fields, recognizable secret literals and required owner claims; it never calls a network/provider API or updates incident state. Exit 1 means missing documentary claims, 2 means invalid/unreadable input. Even exit 0 means **OWNER_ATTESTATION_COMPLETE_NOT_PROVIDER_VERIFIED**: the report keeps provider verification, incident-closure authorization and clinical-rollout authorization false. Documentary completeness is not cryptographic proof of the owner's identity or provider action; an authorized human must assess the referenced evidence through the secure owner channel.

The blank checked-in template intentionally fails completeness and is not owner evidence. Tests use synthetic statements only and cannot close this incident.
