# WHO ICD-10 terminology and mapping

The checked-in `src/clinical-engine/terminology/who-icd10-2019.json` contains 124 K00–K14 entries (15 categories and 109 concrete codes) extracted from the official WHO 2019 COVID-expanded browser. It records source URL, retrieval date, edition and content SHA-256. Official titles are preserved; concrete codes are validated exactly, without ICD-10-CM mixing or category-only confirmation.

Source: [WHO ICD-10 2019 browser, K00–K14](https://icd.who.int/browse10/2019/en#/K00-K14). The extraction used the browser's GetConcept endpoint for this block.

Visible cavitation may support an unconfirmed K02.9 candidate in a research rule. No photo-only determination of depth, pulpitis, periodontal stage or malignancy is allowed. Confirmed codes require independent clinician examination/evidence. Prefix-derived requirements for radiography, vitality, periodontal examination and histopathology are conservative prototype gates, not an approved coding guideline; clinician/coder review of inclusion/exclusion notes and appropriate indications remains required.

Weak folder audit examples: `K0.2.3` is malformed; K02.2 means caries of cementum; K08.3 means retained dental root. Root remnants placed under K04.8 require review; acute avulsion under K08.1 requires injury/context review; K12.2 depends on site/origin and does not validate an abscess from a filename.

The edition accepted by an eventual SATUSEHAT integration has not been established. Submission remains disabled pending official terminology/profile reconciliation and sandbox validation.
