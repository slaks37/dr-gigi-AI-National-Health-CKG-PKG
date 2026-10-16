# SONRI System Architecture

Updated 2026-10-16. Research implementation; no clinical or production approval.

One application, one patient store, one clinical engine.

- `modules/catalog.ts` assigns observable finding and symptom ontologies to five modules; `ModuleSummary` renders them in both age workflows and results. Missing symptoms remain UNKNOWN.
- Patient `/api/screenings` retains unavailable-by-default `OralVision`; no research output is promoted to validated clinical evidence.
- `evidence/schema.ts` validates dentition, FDI-indexed periodontal measurements, sensibility, radiographic interpretations, and lab/histopathology interpretations. Authorized independent clinician review writes these into the existing screening transaction and audit history. Patient submissions cannot supply these fields.
- `ClinicalEvidenceEditor` provides direct structured input on `/clinical-review`; no AI interprets radiographs.
- `/admin/vision-lab` and `/api/vision-lab` require server-verified administrator access. Inventory, terminology coverage, readiness export and optional real local inference are available. Anonymous/patient/doctor inference is denied.
- `local-research.ts` invokes an isolated Python process without a shell, with explicit environment, one run per process, request rate limits, decode/pixel limits, private temporary files, cancellation and wall-clock timeout. Files are removed on success/failure.
- Python `run_local.py` verifies checkpoint hash/permission, loads RF-DETR on CPU, blocks socket connections, strips EXIF through orientation/RGB normalization, and returns only real raw labels/scores/boxes/provenance. Output class IDs must match operator-reviewed manifest labels. No fallback fabricates predictions.
- Research overlays use the exact normalized JPEG returned from server, preserving orientation and normalized coordinates; they never enter clinical reasoning or patient records. Only boxes are implemented; segmentation awaits trained artifacts/alignment evaluation.

No new database, service, billing dependency or external patient-image inference was introduced. Python is optional and needed only by the local lab. Persistent worker/model cache and multi-model comparison remain future work; one model load per lab call is deliberate at this stage.
