"""Auditable detector evaluation; research metrics never confer clinical approval.

The strict benchmark mode requires a documented frozen patient/duplicate audit.
Source reproduction permits an unresolved audit but labels every result accordingly.
Only hash IDs and normalized localization geometry enter the result; no image paths.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from collections import Counter
from pathlib import Path


def resolve_coco_category_ids(categories, source_class_names):
    """COCO IDs are dataset-local; resolve each split by its own declared names."""
    reverse = {name: int(cid) for cid, name in source_class_names.items()}
    if len(reverse) != len(source_class_names):
        raise ValueError('AMBIGUOUS_SOURCE_CLASS_NAMES')
    resolved = {}
    for category in categories:
        cid = category['id']
        if cid in resolved or category.get('name') not in reverse:
            raise ValueError('UNKNOWN_OR_DUPLICATE_COCO_CATEGORY')
        resolved[cid] = reverse[category['name']]
    return resolved


def iou(a, b):
    overlap = max(0, min(a[2], b[2]) - max(a[0], b[0])) * max(0, min(a[3], b[3]) - max(a[1], b[1]))
    union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - overlap
    return overlap / union if union else 0.0


def validate_box(box):
    if not isinstance(box, list) or len(box) != 4 or any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or not 0 <= v <= 1 for v in box) or box[0] >= box[2] or box[1] >= box[3]:
        raise ValueError('INVALID_NORMALIZED_BOX')


def validate_rows(rows, classes, prediction=False):
    for row in rows:
        if row.get('class_id') not in classes or isinstance(row.get('class_id'), bool):
            raise ValueError('UNKNOWN_CLASS_ID')
        validate_box(row.get('box'))
        if prediction and (isinstance(row.get('score'), bool) or not isinstance(row.get('score'), (int, float)) or not math.isfinite(row['score']) or not 0 <= row['score'] <= 1):
            raise ValueError('INVALID_SCORE')


def match_class(images, class_id, minimum_iou, score_threshold=0):
    """Score-ordered greedy matching, independently repeated at each IoU threshold."""
    truths = {item['id']: [g for g in item['annotations'] if g['class_id'] == class_id] for item in images}
    predictions = sorted(((p['score'], item['id'], index, p) for item in images for index, p in enumerate(item['predictions']) if p['class_id'] == class_id and p['score'] >= score_threshold), key=lambda p: (-p[0], p[1], p[2]))
    used = {key: set() for key in truths}
    outcomes = []
    for score, key, index, pred in predictions:
        candidates = [(iou(pred['box'], gt['box']), j) for j, gt in enumerate(truths[key]) if j not in used[key]]
        best, j = max(candidates, default=(0, -1))
        hit = best >= minimum_iou
        if hit:
            used[key].add(j)
        outcomes.append((hit, key, pred, best))
    return truths, used, outcomes


def average_precision(images, class_id, minimum_iou):
    truths, used, outcomes = match_class(images, class_id, minimum_iou)
    n_gt = sum(map(len, truths.values()))
    if not n_gt:
        return None
    tp, fp, curve = 0, 0, []
    for hit, _, _, _ in outcomes:
        tp += int(hit)
        fp += int(not hit)
        curve.append((tp / n_gt, tp / (tp + fp)))
    return sum(max((p for r, p in curve if r >= k / 100), default=0) for k in range(101)) / 101


def wilson(successes, trials):
    if not trials:
        return None
    z, p = 1.959963984540054, successes / trials
    denominator = 1 + z * z / trials
    centre = (p + z * z / (2 * trials)) / denominator
    half = z * math.sqrt((p * (1 - p) + z * z / (4 * trials)) / trials) / denominator
    return [max(0, centre - half), min(1, centre + half)]


def evaluate(images, class_names, confidence=0.25, matching_iou=0.5):
    if not images or len({item['id'] for item in images}) != len(images):
        raise ValueError('EMPTY_OR_DUPLICATE_IMAGE_IDS')
    if not 0 <= confidence <= 1 or not 0 < matching_iou <= 1:
        raise ValueError('INVALID_THRESHOLDS')
    classes = set(class_names)
    for item in images:
        validate_rows(item['annotations'], classes)
        validate_rows(item['predictions'], classes, prediction=True)
    result, errors = [], []
    for cid, name in sorted(class_names.items()):
        truths, used, outcomes = match_class(images, cid, matching_iou, confidence)
        tp = sum(int(hit) for hit, _, _, _ in outcomes)
        fp = len(outcomes) - tp
        total = sum(map(len, truths.values()))
        fn = total - tp
        ap = [average_precision(images, cid, round(0.5 + step * .05, 2)) for step in range(10)]
        for key, gt in truths.items():
            image = next(item for item in images if item['id'] == key)
            for j, row in enumerate(gt):
                if j in used[key]:
                    continue
                relevant = [p for p in image['predictions'] if p['score'] >= confidence]
                same = [p for p in relevant if p['class_id'] == cid]
                reason = 'NO_MATCHING_DETECTION'
                if any(iou(row['box'], p['box']) >= matching_iou and p['class_id'] != cid for p in relevant):
                    reason = 'WRONG_CLASS_AT_REFERENCE_LOCATION'
                elif any(.1 <= iou(row['box'], p['box']) < matching_iou for p in same):
                    reason = 'LOCALIZATION_IOU_BELOW_THRESHOLD'
                elif any(p['class_id'] == cid and p['score'] < confidence and iou(row['box'], p['box']) >= matching_iou for p in image['predictions']):
                    reason = 'CORRECT_LOCATION_BELOW_CONFIDENCE_THRESHOLD'
                elif any(iou(row['box'], p['box']) >= matching_iou for p in same):
                    reason = 'ONE_TO_ONE_MATCH_ALREADY_CONSUMED'
                errors.append({'image_sha256': key, 'type': 'FALSE_NEGATIVE', 'class_id': cid, 'reference_box': row['box'], 'reason': reason})
        for hit, key, pred, overlap in outcomes:
            if not hit:
                errors.append({'image_sha256': key, 'type': 'FALSE_POSITIVE', 'class_id': cid, 'prediction_box': pred['box'], 'score': pred['score'], 'best_unmatched_same_class_iou': overlap})
        precision, recall = tp / (tp + fp) if tp + fp else None, tp / total if total else None
        result.append({'class_id': cid, 'source_class_name': name, 'reference_boxes': total, 'tp': tp, 'fp': fp, 'fn': fn, 'precision': precision, 'recall': recall, 'f1': 2 * tp / (2 * tp + fp + fn) if 2 * tp + fp + fn else None, 'recall_wilson95_box_level': wilson(tp, total), 'ap50': ap[0], 'ap50_95': sum(v for v in ap if v is not None) / len(ap) if total else None})
    return {'images': len(images), 'negative_reference_images': sum(not item['annotations'] for item in images), 'confidence_threshold': confidence, 'matching_iou': matching_iou, 'ap_protocol': '101-point interpolation, score-greedy one-to-one matches, IoU 0.50:0.05:0.95; per-image max_det is declared by runner', 'per_class': result, 'false_negative_reasons': dict(Counter(e['reason'] for e in errors if e['type'] == 'FALSE_NEGATIVE')), 'localization_errors': errors, 'uncertainty_note': 'Wilson intervals treat boxes as independent and are descriptive only; correlated teeth/views and small selected sample preclude patient-level clinical inference.'}


def audit_manifest(manifest, checkpoint_sha256, purpose):
    """Never manufacture patient identity from a filename or count a missing label as healthy."""
    provenance = manifest.get('provenance', {})
    required = ['dataset_id', 'dataset_version', 'license', 'license_evidence', 'clinical_annotation_evidence', 'modality']
    if any(not provenance.get(key) for key in required):
        raise ValueError('DATASET_PROVENANCE_INCOMPLETE')
    if manifest.get('checkpoint_sha256') != checkpoint_sha256:
        raise ValueError('CHECKPOINT_MANIFEST_MISMATCH')
    images = manifest.get('images', [])
    if not images or any(not item.get('sha256') or not item.get('annotation_verified') or 'annotations' not in item for item in images):
        raise ValueError('IMAGE_OR_REFERENCE_EVIDENCE_INCOMPLETE')
    if len({item['sha256'] for item in images}) != len(images):
        raise ValueError('DUPLICATE_TEST_IMAGE_HASH')
    reasons = []
    audit = manifest.get('leakage_audit', {})
    for field in ['patient_identity_verified', 'train_test_patient_disjoint', 'exact_duplicates_checked', 'near_duplicates_adjudicated', 'training_population_complete']:
        if audit.get(field) is not True:
            reasons.append(field.upper() + '_UNVERIFIED')
    if not audit.get('evidence_reference'):
        reasons.append('LEAKAGE_EVIDENCE_REFERENCE_MISSING')
    if any(not item.get('patient_group') for item in images):
        reasons.append('PATIENT_GROUP_MISSING')
    population = manifest.get('split_population', [])
    if not population:
        reasons.append('FROZEN_SPLIT_POPULATION_MISSING')
    else:
        groups = {field: {} for field in ['patient_group', 'sha256', 'duplicate_group', 'near_duplicate_group']}
        for record in population:
            split = record.get('split')
            if split not in {'train', 'val', 'test'} or not record.get('patient_group') or not record.get('sha256'):
                raise ValueError('INVALID_SPLIT_POPULATION')
            for field, partition_by_key in groups.items():
                value = record.get(field)
                if value:
                    prior = partition_by_key.setdefault(value, split)
                    if prior != split:
                        raise ValueError('CROSS_SPLIT_LEAKAGE:' + field.upper())
        population_test = {(row['sha256'], row['patient_group']) for row in population if row['split'] == 'test'}
        if any((row['sha256'], row.get('patient_group')) not in population_test for row in images):
            raise ValueError('TEST_IMAGES_MISSING_FROM_FROZEN_POPULATION')
    if purpose not in {'source-reproduction', 'independent-benchmark'}:
        raise ValueError('INVALID_EVALUATION_PURPOSE')
    # Patient independence alone cannot settle a conflicting annotation/class contract.
    reference = manifest.get('reference_audit', {})
    reference_reasons = [field.upper() + '_UNVERIFIED' for field in
                         ['semantic_label_mapping_verified', 'reference_class_contract_verified', 'independent_reference_review_verified']
                         if reference.get(field) is not True]
    if not reference.get('evidence_reference'):
        reference_reasons.append('REFERENCE_REVIEW_EVIDENCE_MISSING')
    if reference.get('class_contract_conflict') is True:
        reference_reasons.append('REFERENCE_CLASS_CONTRACT_CONFLICT')
    unresolved = reasons + reference_reasons
    if purpose == 'independent-benchmark' and unresolved:
        raise ValueError('INDEPENDENT_BENCHMARK_BLOCKED:' + ','.join(unresolved))
    return {'patient_split_audited': not reasons, 'reference_contract_audited': not reference_reasons,
            'unresolved': unresolved, 'status': 'AUDIT_PASSED' if not unresolved else 'SOURCE_REPRODUCTION_ONLY'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--predictions', type=Path, required=True, help='JSON records keyed by image SHA-256')
    parser.add_argument('--checkpoint-sha256', required=True)
    parser.add_argument('--purpose', choices=['source-reproduction', 'independent-benchmark'], required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text())
    audit = audit_manifest(manifest, args.checkpoint_sha256, args.purpose)
    predictions = json.loads(args.predictions.read_text())
    expected = {item['sha256'] for item in manifest['images']}
    if set(predictions) != expected:
        raise ValueError('PREDICTION_IMAGE_SET_MISMATCH')
    images = [{'id': item['sha256'], 'annotations': item['annotations'], 'predictions': predictions[item['sha256']]} for item in manifest['images']]
    raw_indices = all(str(value).startswith('RAW_TRAINING_CLASS_') for value in manifest['class_names'].values())
    status = 'INDEPENDENT_RESEARCH_BENCHMARK' if args.purpose == 'independent-benchmark' else 'SOURCE_RAW_INDEX_REPRODUCTION' if raw_indices else 'QUARANTINED_REFERENCE_CLASS_CONFLICT' if manifest.get('reference_audit', {}).get('class_contract_conflict') else 'SOURCE_REPRODUCTION_UNVERIFIED_SEMANTICS'
    result = {'schema_version': 'sonri.detection-evaluation.v1', 'clinical_use': 'PROHIBITED', 'purpose': args.purpose, 'status': status, 'semantic_mapping_status': 'VERIFIED' if audit['reference_contract_audited'] else 'UNVERIFIED', 'checkpoint_sha256': args.checkpoint_sha256, 'dataset': manifest['provenance'], 'audit': audit, 'metrics': evaluate(images, {int(k): v for k, v in manifest['class_names'].items()})}
    args.output.write_text(json.dumps(result, indent=2) + '\n')


if __name__ == '__main__':
    main()
