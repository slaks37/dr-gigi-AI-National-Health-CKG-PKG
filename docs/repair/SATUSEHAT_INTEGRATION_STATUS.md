# SATUSEHAT integration status

**Remote submission: NOT_CONFIGURED. Environment: sandbox preparation only. Remote acceptance tests: NOT RUN.**

SONRI now uses WHO ICD-10 **2010**, the edition explicitly required in the official [SATUSEHAT ICD-10 documentation](https://satusehat.kemkes.go.id/platform/docs/id/terminology/icd/icd-10/), checked 24 October 2026. See `docs/ICD10_MAPPING.md` for the complete catalog, source snapshot and review requirements. This establishes the required terminology edition; it does not establish server integration.

## Local draft mappings

`POST /api/satusehat/sync`, authenticated administrator only, accepts `mode: preview` for a local collection of preliminary observations from explicitly measured, plausible height/weight/pulse/temperature. It requires caller-supplied resolved Patient, Encounter, Practitioner and Organization IHS identifiers and a measurement time. NIK resource IDs and estimated/simulated measurements are rejected. Non-preview requests fail closed with HTTP 503 and `NOT_CONFIGURED`.

`POST /api/clinical-fhir`, verified assigned dentist or administrator with record access, accepts:

```json
{
  "mode": "preview",
  "screening_id": "local-record-id",
  "expected_version": 3,
  "identifiers": {
    "patientIhsId": "resolved-patient-id",
    "organizationIhsId": "resolved-organization-id",
    "practitionerIhsId": "resolved-reviewer-practitioner-id",
    "encounterIhsId": "resolved-encounter-id"
  }
}
```

It reads diagnoses from the stored, clinician-approved screening, never from caller-supplied diagnosis codes. Patient linkage, nonblank clinical evidence, current terminology, exact terminal WHO codes and optimistic record version are required. The resulting local FHIR R4 collection contains one `Condition` for each clinician-confirmed code and a reviewer `Provenance` linking all resources to the local source. The draft includes exact WHO code/title and `version: 2010`, references supplied IHS IDs, and converts recording time to UTC. It does not invent activity status, onset, or anatomical association between each code and each tooth.

A stored odontogram may add preliminary `Observation` resources for assessed teeth. FDI is preserved in `bodySite.text`; an unverified official tooth coding system is not invented. NOT_ASSESSED teeth do not become negative observations. The odontogram is omitted if its author differs from the final reviewer, because the supplied Practitioner identifier identifies that reviewer. Preview generation produces an audit event without copying IHS IDs into logs.

All responses identify `DRAFT`, `submitted: false`, and local-preview limitations. These are collection bundles, without transaction instructions. There is no network submission, OAuth request, accepted-resource ID or synchronization timestamp.

The mapping was checked against official [SATUSEHAT Condition guidance](https://satusehat.kemkes.go.id/platform/docs/id/fhir/resources/condition/), [FHIR R4 Condition](https://hl7.org/fhir/R4/condition.html), and [FHIR R4 Provenance](https://hl7.org/fhir/R4/provenance.html). Local software contract tests do not establish profile validation or remote acceptance.

## External validation gates

Official credentials and approved sandbox setup are unavailable in this workspace. Before enabling transmission, validate the target program's implementation guide, required Condition clinical activity fields, patient/encounter/practitioner/organization resolution, authorized reviewer identity binding, odontogram terminology, consent, OAuth secret provisioning, idempotent durable outbox and redacted remote audit. SYNCED requires a real successful remote response plus persisted returned resource IDs. Remote rejection/retry behavior remains untested until an authorized submission implementation and sandbox are available.
