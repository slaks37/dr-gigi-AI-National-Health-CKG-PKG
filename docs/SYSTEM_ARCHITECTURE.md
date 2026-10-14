# System architecture — experimental implementation

Next.js routes authenticate Firebase ID tokens on the server. Firestore is the authoritative record store. The browser submits symptoms, patient context, consent and at most four image inputs. It cannot grant roles, reviewer credentials, dataset scopes, model approval or confirmed diagnoses.

```mermaid
flowchart LR
 UI[Adult / pediatric questionnaire] --> T[Immediate deterministic triage]
 UI --> API[Authenticated screening API]
 API --> T
 T --> Q[Bounded local image quality checks]
 Q --> V[Approved vision adapter gate]
 V --> R[Versioned deterministic reasoning]
 R --> S[Strict structured screening]
 S --> DB[Firestore transaction + audit]
 DB --> C[Independent assigned qualified clinician]
 C --> DB
 DS[Authorized Drive metadata] --> A[Annotation + independent review]
 A --> F[Frozen patient-level training preparation]
```

Emergency messages are available before authentication/upload in the browser; authenticated API triage precedes decoding. No remote clinical LLM, validated detector, trained checkpoint, IoT ingestion or SATUSEHAT submission is enabled. Explanations are deterministic. This is a review candidate layered on the security repair, not a production release.

See [clinical engine](CLINICAL_ENGINE_ARCHITECTURE.md), [database](DATABASE_ARCHITECTURE.md), [limitations](CLINICAL_LIMITATIONS.md) and [release gates](DEPLOYMENT_CHECKLIST.md).
