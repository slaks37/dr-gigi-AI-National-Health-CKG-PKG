"""Offline population audit -> validation-only threshold freeze -> held-out test.

Images and manifests stay private. Documentary assertions are required but are not
provider, patient-identity, licensing or clinical verification by this software.
No network/model/training operation is performed. Synthetic fixtures stay labeled.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import io
import json
import math
from pathlib import Path
import re
import struct
import subprocess

from evaluate import evaluate, iou, match_class, validate_rows


APP_ROOT = Path(__file__).resolve().parents[2]
MAX_RECORDS = 2000
MAX_IMAGE_BYTES = 25_000_000
MAX_TOTAL_BYTES = 512_000_000
MAX_IMAGE_PIXELS = 25_000_000
MAX_TOTAL_PIXELS = 200_000_000
MAX_JSON_BYTES = 16_000_000
NEAR_DHASH_DISTANCE = 6
ATTESTATIONS = [
    'data_rights_confirmed', 'consent_or_approved_waiver_confirmed',
    'clinical_reference_independently_reviewed', 'semantic_class_mapping_verified',
    'patient_group_identity_verified', 'complete_training_population_declared',
    'train_val_test_frozen',
]
SHA = re.compile(r'[0-9a-f]{64}')
OPAQUE = re.compile(r'[0-9a-f]{32,64}')


def require(condition, code):
    if not condition:
        raise ValueError(code)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()).hexdigest()


def seal(value):
    result = dict(value)
    result['content_sha256'] = digest(value)
    return result


def verify_seal(value):
    require(isinstance(value, dict) and 'content_sha256' in value, 'MISSING_ARTIFACT_SEAL')
    require(value['content_sha256'] == digest({k: v for k, v in value.items() if k != 'content_sha256'}), 'ARTIFACT_CONTENT_TAMPERED')


def _unique(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, 'DUPLICATE_JSON_FIELD')
        result[key] = value
    return result


def read_json(path):
    path = Path(path)
    private_root(path.absolute().parent)
    require(path.is_file() and not path.is_symlink() and path.stat().st_size <= MAX_JSON_BYTES, 'INVALID_OR_OVERSIZED_JSON_FILE')
    return json.loads(path.read_text(), object_pairs_hook=_unique,
                      parse_constant=lambda _: (_ for _ in ()).throw(ValueError('NONFINITE_JSON_VALUE')))


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + '\n')


def private_root(path):
    root = Path(path).resolve()
    require(root.is_dir() and not root.is_relative_to(APP_ROOT), 'PRIVATE_DATA_MUST_BE_OUTSIDE_APPLICATION_GIT')
    # A parent workspace can itself be a Git repository. Require its ignore rule too.
    for ancestor in [root, *root.parents]:
        if (ancestor / '.git').exists():
            relative = str(root.relative_to(ancestor)) + '/'
            result = subprocess.run(['git', '-C', str(ancestor), 'check-ignore', '--quiet', '--no-index', '--', relative],
                                    capture_output=True, check=False)
            require(result.returncode == 0, 'PRIVATE_IMAGE_DIRECTORY_NOT_IGNORED_BY_PARENT_GIT')
    return root


def _nonempty(value):
    return isinstance(value, str) and bool(value.strip()) and len(value) <= 512


def load_manifest(path, allow_synthetic=False):
    manifest = read_json(path)
    require(manifest.get('schema_version') == 'sonri.independent-population.v1', 'INDEPENDENT_POPULATION_SCHEMA_REQUIRED')
    kind = manifest.get('data_kind')
    require(kind in {'REAL_DENTAL_IMAGES', 'SYNTHETIC_SOFTWARE_FIXTURE'}, 'EXPLICIT_DATA_KIND_REQUIRED')
    require(kind != 'SYNTHETIC_SOFTWARE_FIXTURE' or allow_synthetic, 'SYNTHETIC_FIXTURE_OPT_IN_REQUIRED')
    require(SHA.fullmatch(str(manifest.get('checkpoint_sha256', ''))), 'CHECKPOINT_SHA256_REQUIRED')
    classes = manifest.get('class_names', {})
    require(isinstance(classes, dict) and 0 < len(classes) <= 64, 'INVALID_CLASS_SCHEMA')
    require(all(isinstance(key, str) and re.fullmatch(r'0|[1-9][0-9]{0,3}', key) and _nonempty(value)
                for key, value in classes.items()) and len(set(classes.values())) == len(classes), 'INVALID_CLASS_SCHEMA')
    provenance = manifest.get('provenance', {})
    require(all(_nonempty(provenance.get(key)) for key in
                ['dataset_id', 'dataset_version', 'modality', 'license', 'license_evidence', 'clinical_annotation_evidence']), 'PROVENANCE_INCOMPLETE')
    attestation = manifest.get('attestations', {})
    require(all(attestation.get(key) is True for key in ATTESTATIONS)
            and _nonempty(attestation.get('evidence_reference')), 'EXTERNAL_OWNER_REVIEW_ATTESTATIONS_INCOMPLETE')
    require(manifest.get('source_reproduction_only') is not True, 'SOURCE_REPRODUCTION_NOT_INDEPENDENT')
    records = manifest.get('records')
    require(isinstance(records, list) and 3 <= len(records) <= MAX_RECORDS, 'INVALID_OR_OVERSIZED_POPULATION')
    require({row.get('split') for row in records} == {'train', 'val', 'test'}, 'ALL_TRAIN_VAL_TEST_POPULATIONS_REQUIRED')
    ids = set()
    groups = {}
    classes_int = {int(key): value for key, value in classes.items()}
    for row in records:
        rid, group = row.get('record_id'), row.get('patient_group')
        require(isinstance(rid, str) and OPAQUE.fullmatch(rid) and rid not in ids, 'OPAQUE_UNIQUE_RECORD_ID_REQUIRED')
        ids.add(rid)
        require(isinstance(group, str) and OPAQUE.fullmatch(group), 'OPAQUE_PATIENT_GROUP_REQUIRED')
        require(groups.setdefault(group, row['split']) == row['split'], 'CROSS_SPLIT_PATIENT_LEAKAGE')
        require(SHA.fullmatch(str(row.get('sha256', ''))), 'DECLARED_IMAGE_SHA256_REQUIRED')
        require(row.get('reference_reviewed') is True and _nonempty(row.get('review_evidence_reference'))
                and isinstance(row.get('annotations'), list), 'EXPLICIT_REVIEWED_REFERENCE_REQUIRED')
        require(row['annotations'] or row.get('reviewed_negative') is True, 'EMPTY_LABELS_REQUIRE_EXPLICIT_REVIEWED_NEGATIVE')
        require(len(row['annotations']) <= 1000, 'TOO_MANY_REFERENCE_BOXES')
        validate_rows(row['annotations'], set(classes_int))
    require(all(any(row['split'] == split and not row['annotations'] and row.get('reviewed_negative') is True
                    for row in records) for split in ['val', 'test']), 'REVIEWED_NEGATIVE_CONTROL_REQUIRED_FOR_VAL_AND_TEST')
    protocol = manifest.get('threshold_protocol', {})
    grid = protocol.get('candidates', [])
    require(isinstance(grid, list) and 1 <= len(grid) <= 21
            and all(type(v) in {float, int} and math.isfinite(v) and 0 <= v <= 1 for v in grid)
            and grid == sorted(set(grid)), 'INVALID_PREDECLARED_THRESHOLD_GRID')
    require(protocol.get('objective') == 'MAXIMIZE_CLASS_F1_TIE_RECALL_THEN_HIGHER_THRESHOLD', 'UNSUPPORTED_THRESHOLD_OBJECTIVE')
    minimum_iou = protocol.get('matching_iou')
    require(type(minimum_iou) in {float, int} and math.isfinite(minimum_iou) and 0 < minimum_iou <= 1, 'INVALID_MATCHING_IOU')
    return manifest


def image_fingerprint(row, root):
    from PIL import Image, ImageOps
    name = row.get('private_path')
    require(isinstance(name, str) and len(name) <= 1024 and not Path(name).is_absolute(), 'PRIVATE_RELATIVE_IMAGE_PATH_REQUIRED')
    candidate = root / name
    path = candidate.resolve()
    require(not candidate.is_symlink() and path.is_relative_to(root) and path.is_file(), 'IMAGE_PATH_ESCAPE_OR_MISSING_FILE')
    require(path.stat().st_size <= MAX_IMAGE_BYTES, 'IMAGE_BYTE_LIMIT')
    data = path.read_bytes()
    raw = hashlib.sha256(data).hexdigest()
    require(raw == row['sha256'], 'IMAGE_RAW_SHA256_MISMATCH')
    with Image.open(io.BytesIO(data)) as image:
        require(getattr(image, 'n_frames', 1) == 1, 'MULTIFRAME_IMAGE_UNSUPPORTED')
        require(0 < image.width * image.height <= MAX_IMAGE_PIXELS, 'IMAGE_PIXEL_LIMIT')
        rgb = ImageOps.exif_transpose(image).convert('RGB')
        pixels = hashlib.sha256(b'SONRI_RGB_V1\0' + struct.pack('>II', rgb.width, rgb.height) + rgb.tobytes()).hexdigest()
        gray = rgb.convert('L').resize((9, 8), Image.Resampling.BILINEAR)
        values = gray.tobytes()
        dhash = 0
        for y in range(8):
            for x in range(8):
                dhash = (dhash << 1) | (values[y * 9 + x] > values[y * 9 + x + 1])
        return {'record_id': row['record_id'], 'split': row['split'], 'raw_sha256': raw,
                'canonical_rgb_sha256': pixels, 'dhash64': f'{dhash:016x}', 'width': rgb.width,
                'height': rgb.height, 'bytes': len(data)}


def audit_population(manifest_path, image_root, allow_synthetic=False):
    manifest = load_manifest(manifest_path, allow_synthetic)
    root = private_root(image_root)
    fingerprints, raw_seen, pixels_seen = [], set(), set()
    total_bytes = total_pixels = 0
    for row in manifest['records']:
        actual = image_fingerprint(row, root)
        require(actual['raw_sha256'] not in raw_seen, 'EXACT_RAW_IMAGE_DUPLICATE')
        require(actual['canonical_rgb_sha256'] not in pixels_seen, 'CANONICAL_RGB_IMAGE_DUPLICATE')
        raw_seen.add(actual['raw_sha256'])
        pixels_seen.add(actual['canonical_rgb_sha256'])
        total_bytes += actual['bytes']
        total_pixels += actual['width'] * actual['height']
        require(total_bytes <= MAX_TOTAL_BYTES and total_pixels <= MAX_TOTAL_PIXELS, 'POPULATION_RESOURCE_LIMIT')
        fingerprints.append(actual)
    by_id = {item['record_id']: item for item in fingerprints}
    reviews = {}
    for review in manifest.get('near_duplicate_reviews', []):
        pair = review.get('pair', [])
        require(isinstance(pair, list) and len(pair) == 2 and len(set(pair)) == 2 and set(pair) <= by_id.keys(), 'INVALID_NEAR_DUPLICATE_REVIEW')
        key = tuple(sorted(pair))
        require(key not in reviews, 'DUPLICATE_NEAR_DUPLICATE_REVIEW')
        require(review.get('raw_sha256_pair') == sorted(by_id[rid]['raw_sha256'] for rid in pair), 'STALE_NEAR_DUPLICATE_REVIEW')
        reviews[key] = review
    candidates = []
    within = 0
    for index, first in enumerate(fingerprints):
        for second in fingerprints[index + 1:]:
            distance = (int(first['dhash64'], 16) ^ int(second['dhash64'], 16)).bit_count()
            if distance > NEAR_DHASH_DISTANCE:
                continue
            if first['split'] == second['split']:
                within += 1
                continue
            pair = tuple(sorted([first['record_id'], second['record_id']]))
            review = reviews.get(pair, {})
            distinct = (review.get('decision') == 'DISTINCT_IMAGES' and review.get('reviewed') is True
                        and review.get('independent_reviewer_confirmed') is True and _nonempty(review.get('evidence_reference')))
            candidates.append({'pair': list(pair), 'dhash_hamming': distance,
                               'resolution': 'REVIEWED_DISTINCT' if distinct else 'BLOCKED_REVIEW_REQUIRED',
                               'review_sha256': digest(review) if review else None})
    blocked = any(item['resolution'] != 'REVIEWED_DISTINCT' for item in candidates)
    return seal({'schema_version': 'sonri.independent-population-audit.v1',
                 'status': 'BLOCKED_NEAR_DUPLICATE_REVIEW' if blocked else 'AUDIT_PASSED',
                 'data_kind': manifest['data_kind'], 'clinical_use': 'PROHIBITED',
                 'manifest_sha256': digest(manifest), 'checkpoint_sha256': manifest['checkpoint_sha256'],
                 'eligible_for_independent_research': not blocked and manifest['data_kind'] == 'REAL_DENTAL_IMAGES',
                 'externally_verified_by_this_software': False,
                 'population_counts': dict(Counter(row['split'] for row in manifest['records'])),
                 'reviewed_negative_counts': {split: sum(row['split'] == split and not row['annotations']
                                                          for row in manifest['records']) for split in ['train', 'val', 'test']},
                 'anonymous_patient_groups': len({row['patient_group'] for row in manifest['records']}),
                 'total_image_bytes': total_bytes, 'total_decoded_pixels': total_pixels,
                 'canonical_pixel_protocol': 'EXIF-transposed RGB; SHA256(prefix SONRI_RGB_V1 NUL + big-endian width,height + RGB bytes)',
                 'near_duplicate_protocol': {'algorithm': '64-bit horizontal dHash, grayscale BILINEAR 9x8',
                                             'maximum_hamming_distance': NEAR_DHASH_DISTANCE,
                                             'heuristic_not_proof_of_independence': True,
                                             'within_split_candidates': within},
                 'images': sorted(fingerprints, key=lambda row: row['record_id']),
                 'cross_split_near_duplicate_candidates': candidates})


def verified_audit(manifest_path, image_root, audit_path, allow_synthetic=False):
    prior = read_json(audit_path)
    verify_seal(prior)
    current = audit_population(manifest_path, image_root, allow_synthetic)
    require(current['content_sha256'] == prior['content_sha256'], 'AUDIT_STALE_OR_POPULATION_CHANGED')
    require(current['status'] == 'AUDIT_PASSED', 'AUDIT_NOT_APPROVED')
    return current


def load_predictions(path, manifest, split):
    value = read_json(path)
    require(value.get('schema_version') == 'sonri.independent-predictions.v1', 'PREDICTION_SCHEMA_REQUIRED')
    require(value.get('split') == split, 'PREDICTION_SPLIT_MISMATCH')
    require(value.get('manifest_sha256') == digest(manifest)
            and value.get('checkpoint_sha256') == manifest['checkpoint_sha256'], 'PREDICTION_PROVENANCE_MISMATCH')
    run = value.get('inference_run', {})
    floor, max_det = run.get('score_floor'), run.get('max_det')
    require(_nonempty(run.get('evidence_reference')) and type(floor) in {int, float}
            and math.isfinite(floor) and 0 <= floor <= 1 and type(max_det) is int and 1 <= max_det <= 1000
            and SHA.fullmatch(str(run.get('pipeline_sha256', ''))), 'PREDICTION_RUN_CONTRACT_REQUIRED')
    rows = value.get('records', {})
    expected = {row['record_id'] for row in manifest['records'] if row['split'] == split}
    require(isinstance(rows, dict) and set(rows) == expected, 'PREDICTION_IMAGE_SET_MISMATCH')
    for predictions in rows.values():
        require(isinstance(predictions, list) and len(predictions) <= max_det, 'PREDICTION_COUNT_LIMIT')
        validate_rows(predictions, {int(key) for key in manifest['class_names']}, prediction=True)
        require(all(row['score'] >= floor for row in predictions), 'PREDICTION_BELOW_DECLARED_SCORE_FLOOR')
    return value


def _images(manifest, predictions, split):
    return [{'id': row['sha256'], 'annotations': row['annotations'], 'predictions': predictions['records'][row['record_id']]}
            for row in manifest['records'] if row['split'] == split]


def _operating_point(images, cid, threshold, minimum_iou):
    truths, used, outcomes = match_class(images, cid, minimum_iou, threshold)
    tp = sum(int(hit) for hit, _, _, _ in outcomes)
    fp = len(outcomes) - tp
    fn = sum(map(len, truths.values())) - tp
    negatives = [row for row in images if not row['annotations']]
    false_positive_negatives = sum(any(p['class_id'] == cid and p['score'] >= threshold for p in row['predictions']) for row in negatives)
    return {'threshold': threshold, 'tp': tp, 'fp': fp, 'fn': fn,
            'precision': tp / (tp + fp) if tp + fp else None,
            'recall': tp / (tp + fn) if tp + fn else None,
            'f1': 2 * tp / (2 * tp + fp + fn) if 2 * tp + fp + fn else None,
            'reviewed_negative_images': len(negatives), 'negative_images_with_fp': false_positive_negatives,
            'negative_image_fpr': false_positive_negatives / len(negatives) if negatives else None}


def select_thresholds(manifest_path, image_root, audit_path, validation_predictions_path, allow_synthetic=False):
    audit = verified_audit(manifest_path, image_root, audit_path, allow_synthetic)
    manifest = load_manifest(manifest_path, allow_synthetic)
    predictions = load_predictions(validation_predictions_path, manifest, 'val')
    images = _images(manifest, predictions, 'val')
    protocol = manifest['threshold_protocol']
    require(min(protocol['candidates']) >= predictions['inference_run']['score_floor'], 'THRESHOLD_GRID_BELOW_PREDICTION_SCORE_FLOOR')
    thresholds, analysis = {}, []
    for cid in sorted(int(key) for key in manifest['class_names']):
        require(any(gt['class_id'] == cid for row in images for gt in row['annotations']), 'VALIDATION_CLASS_WITHOUT_REFERENCE')
        points = [_operating_point(images, cid, threshold, protocol['matching_iou']) for threshold in protocol['candidates']]
        best = max(points, key=lambda point: (point['f1'] or 0, point['recall'] or 0, point['threshold']))
        thresholds[str(cid)] = best['threshold']
        analysis.append({'class_id': cid, 'selected': best, 'candidate_operating_points': points})
    return seal({'schema_version': 'sonri.frozen-validation-threshold-plan.v1',
                 'data_kind': manifest['data_kind'], 'clinical_use': 'PROHIBITED',
                 'selection_split': 'val', 'test_predictions_accessed': False,
                 'manifest_sha256': digest(manifest), 'audit_sha256': audit['content_sha256'],
                 'checkpoint_sha256': manifest['checkpoint_sha256'],
                 'validation_predictions_sha256': digest(predictions), 'threshold_protocol': protocol,
                 'thresholds': thresholds, 'validation_images': len(images), 'per_class_validation_analysis': analysis,
                 'freeze_instruction': 'Record this content_sha256 before opening test predictions. Test requires the expected frozen SHA256 and recomputes selection only from validation inputs.'})


def evaluate_test(manifest_path, image_root, audit_path, validation_predictions_path,
                  threshold_plan_path, expected_plan_sha256, test_predictions_path, allow_synthetic=False):
    plan = read_json(threshold_plan_path)
    verify_seal(plan)
    require(SHA.fullmatch(str(expected_plan_sha256)) and plan['content_sha256'] == expected_plan_sha256, 'FROZEN_THRESHOLD_PLAN_SHA256_MISMATCH')
    derived = select_thresholds(manifest_path, image_root, audit_path, validation_predictions_path, allow_synthetic)
    require(derived['content_sha256'] == plan['content_sha256'], 'THRESHOLD_PLAN_NOT_DERIVED_FROM_BOUND_VALIDATION')
    manifest = load_manifest(manifest_path, allow_synthetic)
    predictions = load_predictions(test_predictions_path, manifest, 'test')
    val_predictions = load_predictions(validation_predictions_path, manifest, 'val')
    require(all(predictions['inference_run'][key] == val_predictions['inference_run'][key]
                for key in ['score_floor', 'max_det', 'pipeline_sha256']), 'VALIDATION_TEST_INFERENCE_CONTRACT_MISMATCH')
    images = _images(manifest, predictions, 'test')
    minimum_iou = plan['threshold_protocol']['matching_iou']
    classes = {int(key): name for key, name in manifest['class_names'].items()}
    filtered = [{**row, 'predictions': [p for p in row['predictions'] if p['score'] >= plan['thresholds'][str(p['class_id'])]]} for row in images]
    operating = evaluate(filtered, classes, confidence=0, matching_iou=minimum_iou)
    all_score = evaluate(images, classes, confidence=0, matching_iou=minimum_iou)
    raw_by_class = {row['class_id']: row for row in all_score['per_class']}
    for row in operating['per_class']:
        cid = row['class_id']
        row.pop('source_class_name', None)  # Private source strings never enter the public report.
        row['frozen_confidence_threshold'] = plan['thresholds'][str(cid)]
        row['ap50'] = raw_by_class[cid]['ap50']
        row['ap50_95'] = raw_by_class[cid]['ap50_95']
        point = _operating_point(images, cid, row['frozen_confidence_threshold'], minimum_iou)
        row.update({key: point[key] for key in ['reviewed_negative_images', 'negative_images_with_fp', 'negative_image_fpr']})
    raw_images = {row['id']: row for row in images}
    for error in operating['localization_errors']:
        if error['type'] == 'FALSE_NEGATIVE' and error['reason'] == 'NO_MATCHING_DETECTION':
            cid = error['class_id']
            if any(p['class_id'] == cid and p['score'] < plan['thresholds'][str(cid)]
                   and iou(p['box'], error['reference_box']) >= minimum_iou for p in raw_images[error['image_sha256']]['predictions']):
                error['reason'] = 'CORRECT_LOCATION_BELOW_FROZEN_CLASS_THRESHOLD'
    operating['false_negative_reasons'] = dict(Counter(row['reason'] for row in operating['localization_errors'] if row['type'] == 'FALSE_NEGATIVE'))
    negatives = [row for row in filtered if not row['annotations']]
    negative_fp = sum(bool(row['predictions']) for row in negatives)
    operating.pop('confidence_threshold', None)
    operating.update({'thresholds': plan['thresholds'], 'reviewed_negative_images': len(negatives),
                      'negative_images_with_any_fp': negative_fp,
                      'negative_image_fpr_any_class': negative_fp / len(negatives) if negatives else None,
                      'ap_score_scope': 'All supplied pre-threshold predictions; declared score floor/max_det limit AP. Operating counts use frozen per-class thresholds.'})
    operating['classes_with_test_reference_boxes'] = [row['class_id'] for row in operating['per_class'] if row['reference_boxes']]
    operating['classes_without_test_reference_boxes'] = [row['class_id'] for row in operating['per_class'] if not row['reference_boxes']]
    real = manifest['data_kind'] == 'REAL_DENTAL_IMAGES'
    return seal({'schema_version': 'sonri.independent-frozen-test-result.v1',
                 'status': 'INDEPENDENT_RESEARCH_BENCHMARK' if real else 'SYNTHETIC_SOFTWARE_TEST_ONLY',
                 'data_kind': manifest['data_kind'], 'clinical_use': 'PROHIBITED', 'clinically_validated': False,
                 'inference_performed_by_this_evaluator': False, 'external_attestations_verified_by_this_software': False,
                 'bindings': {'manifest_sha256': digest(manifest), 'audit_sha256': plan['audit_sha256'],
                              'checkpoint_sha256': manifest['checkpoint_sha256'], 'threshold_plan_sha256': plan['content_sha256'],
                              'validation_predictions_sha256': plan['validation_predictions_sha256'],
                              'test_predictions_sha256': digest(predictions)},
                 'prediction_retention': {key: predictions['inference_run'][key] for key in ['score_floor', 'max_det', 'pipeline_sha256']},
                 'metrics': operating,
                 'limitations': ['Owner/reviewer assertions require independent documentary verification.',
                                 'dHash is a screening heuristic, not proof that all transformations or patient links were found.',
                                 'Threshold freeze hashes detect stale/mutated artifacts, not dishonest operators or fabricated attestations.',
                                 'Box-level confidence intervals do not measure patient-level clinical validity.']})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='stage', required=True)
    for name in ['audit', 'select-thresholds', 'test']:
        child = sub.add_parser(name)
        child.add_argument('--manifest', type=Path, required=True)
        child.add_argument('--private-images', type=Path, required=True)
        child.add_argument('--output', type=Path, required=True)
        child.add_argument('--allow-synthetic-software-fixtures', action='store_true')
        if name != 'audit':
            child.add_argument('--audit', type=Path, required=True)
            child.add_argument('--validation-predictions', type=Path, required=True)
        if name == 'test':
            child.add_argument('--threshold-plan', type=Path, required=True)
            child.add_argument('--frozen-plan-sha256', required=True)
            child.add_argument('--test-predictions', type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.stage == 'audit':
            result = audit_population(args.manifest, args.private_images, args.allow_synthetic_software_fixtures)
        elif args.stage == 'select-thresholds':
            result = select_thresholds(args.manifest, args.private_images, args.audit,
                                       args.validation_predictions, args.allow_synthetic_software_fixtures)
        else:
            result = evaluate_test(args.manifest, args.private_images, args.audit, args.validation_predictions,
                                   args.threshold_plan, args.frozen_plan_sha256, args.test_predictions,
                                   args.allow_synthetic_software_fixtures)
        write_json(args.output, result)
        print(json.dumps({'stage': args.stage, 'status': result.get('status', 'VALIDATION_THRESHOLDS_FROZEN'),
                          'content_sha256': result['content_sha256'], 'clinical_use': 'PROHIBITED'}))
        return 1 if str(result.get('status', '')).startswith('BLOCKED') else 0
    except Exception as error:
        # Paths, patient groups, source filenames and exception payloads stay private.
        code = str(error) if type(error) is ValueError and re.fullmatch(r'[A-Z0-9_]+', str(error)) else 'PRIVATE_INPUT_REJECTED'
        print(json.dumps({'error': code, 'clinical_use': 'PROHIBITED', 'private_values_emitted': False}))
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
