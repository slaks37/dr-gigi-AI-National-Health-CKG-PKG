# SATUSEHAT integration status

**Remote submission: NOT_CONFIGURED. Environment: sandbox only. Remote acceptance tests: NOT RUN.**

The former endpoint created a bundle and invented synchronization success. It is replaced with an authenticated, administrator-only gate. Non-preview requests return HTTP 503, success=false, NOT_CONFIGURED and no accepted-resource ID or sync timestamp.

`mode=preview` builds a local FHIR collection of preliminary observations from explicitly measured, plausible height/weight/pulse/temperature values. It requires caller-provided resolved Patient, Encounter, Practitioner and Organization IHS identifiers and a valid measurement time; a 16-digit NIK is rejected as a resource ID. Estimated/simulated values, AI diagnoses and unsupported fields are rejected. The collection is DRAFT, submitted=false. It does not prove reference resolution, official profile compliance or server acceptance.

The UI contains no example NIK, credential, hardcoded transaction acceptance or production-environment switch. There is no automatic network submission or OAuth request.

## BLOCKED

Official organization credentials and approved sandbox setup were unavailable. The program-specific implementation guide, resolved IHS identities, encounter references, clinician approval, OAuth secret provisioning, idempotent durable submission/outbox and redacted remote audit are required before enabling submission. SYNCED must only be implemented after a real successful remote response and persisted returned resource IDs. HTTP rejection/retry cannot be truthfully exercised against a remote submission implementation that does not yet exist; it remains blocked rather than mocked as external success.

The official [SATUSEHAT authentication guidance](https://satusehat.kemkes.go.id/platform/docs/id/api-catalogue/authentication/) was inspected on 14 October 2026 and specifies server-to-server OAuth client_credentials with distinct sandbox/production endpoints. This repair follows its server-only credential boundary and performs no remote medical transaction.
