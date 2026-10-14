# Baseline and repair status

Baseline source was main `358a7344e922aad174075bf6377f2ccf8e98abf9`. Security repair base `c337536df82e3f24be1831476d6e39493ec92f42` is a separate draft PR. This implementation is stacked on that repair.

| Area | Finding / current action | Release status |
|---|---|---|
| Clinical generation | Legacy unconstrained photo diagnosis gated; strict deterministic triage/review added | Experimental; clinical approval pending |
| Authorization | Server token claims, owner/assignment scope, independent reviewer gates | Synthetic emulator verified |
| Storage | Transactional idempotent screening/versioned review/audit; no source image retention | Production migration/reconciliation pending |
| Dataset | Read-only 3,521-file observed metadata snapshot; weak labels separated | Complete census and reviewed cohort unavailable |
| Training | Permission/quality/label/patient/duplicate gates and COCO preparation | Zero real training; no installed model |
| Terminology | Official versioned WHO titles; prototype exam gates | Clinical/coding sign-off and integration edition pending |
| External systems | Clinical providers, SATUSEHAT and devices remain gated | No production deployment |

Original security evidence is retained in `docs/repair/`. The new QA report distinguishes software tests from clinical validation.
