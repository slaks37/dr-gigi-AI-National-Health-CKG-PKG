# Clinical limitations

This is an experimental screening/review system, not an autonomous dental diagnosis service. The developer is not represented as a licensed clinician. Rule approval, prospective validation and calibrated confidence are unavailable. No installed oral detector, trained SONRI model or clinical performance metrics exist.

Engineering checks identify decode/format/size/darkness/blur problems; they cannot certify oral visibility or lesion absence. A valid image with no approved detector returns review required/inconclusive, never healthy. No source image is retained, so subsequent clinical review depends on examination and authorized clinical evidence. The clinician UI currently supports direct examination, evidence and code confirmation; it does not provide a new photo-finding editor.

No dataset image quality, duplicates, patient grouping or clinical annotations were assessed in the metadata snapshot. Folder classifications remain weak hints. Documentary consent references and retention scope are pending despite user attestation of verification.

SATUSEHAT, clinical Gemini/Agnes diagnosis, rPPG/posture predictions and IoT ingestion remain gated. End-to-end authenticated production workflows, real clinician provisioning, remote integration and real training were not executed. Successful synthetic tests do not establish clinical efficacy or production approval.
