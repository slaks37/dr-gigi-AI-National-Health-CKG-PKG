"""Actual synthetic pixels exercise software only; never a clinical benchmark."""
import hashlib
import json
from pathlib import Path
import random
import subprocess
import sys
import tempfile

from PIL import Image
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import independent as bench


BOXES = {0: [.1, .1, .4, .4], 1: [.6, .6, .9, .9]}


def pred(cid, score, box=None):
    return {'class_id': cid, 'box': box or BOXES[cid], 'score': score}


@pytest.fixture
def cohort(tmp_path):
    root = tmp_path / 'private-images'
    root.mkdir()
    rows = []
    splits = [('train', 0), ('val', 0), ('val', 1), ('val', None),
              ('test', 0), ('test', 1), ('test', None)]
    for index, (split, cid) in enumerate(splits):
        filename = f'PRIVATE_FILENAME_SENTINEL_{index}.png'
        rng = random.Random(index + 1800)
        Image.frombytes('RGB', (40, 40), bytes(rng.randrange(256) for _ in range(40 * 40 * 3))).save(root / filename)
        rows.append({'record_id': hashlib.sha256(f'opaque-record-{index}'.encode()).hexdigest(),
                     'patient_group': hashlib.sha256(f'opaque-patient-{index}'.encode()).hexdigest(),
                     'split': split, 'private_path': filename,
                     'sha256': hashlib.sha256((root / filename).read_bytes()).hexdigest(),
                     'annotations': [] if cid is None else [{'class_id': cid, 'box': BOXES[cid]}],
                     'reference_reviewed': True, 'reviewed_negative': cid is None,
                     'review_evidence_reference': 'PRIVATE_REVIEW_SENTINEL'})
    manifest = {'schema_version': 'sonri.independent-population.v1',
                'data_kind': 'SYNTHETIC_SOFTWARE_FIXTURE', 'checkpoint_sha256': 'a' * 64,
                'class_names': {'0': 'PRIVATE_CLASS_SENTINEL_ZERO', '1': 'PRIVATE_CLASS_SENTINEL_ONE'},
                'provenance': {key: 'SYNTHETIC_DOCUMENTARY_FIXTURE_ONLY' for key in
                               ['dataset_id', 'dataset_version', 'modality', 'license', 'license_evidence', 'clinical_annotation_evidence']},
                'attestations': {**{key: True for key in bench.ATTESTATIONS}, 'evidence_reference': 'PRIVATE_ATTESTATION_SENTINEL'},
                'records': rows, 'near_duplicate_reviews': [],
                'threshold_protocol': {'candidates': [.1, .5, .9], 'matching_iou': .5,
                                       'objective': 'MAXIMIZE_CLASS_F1_TIE_RECALL_THEN_HIGHER_THRESHOLD'}}
    val = {rows[1]['record_id']: [pred(0, .65), pred(0, .35)], rows[2]['record_id']: [pred(1, .8)],
           rows[3]['record_id']: [pred(0, .4), pred(1, .2)]}
    test = {rows[4]['record_id']: [pred(0, .45)], rows[5]['record_id']: [pred(1, .9), pred(0, .95)],
            rows[6]['record_id']: [pred(0, .7), pred(1, .2)]}
    return {'directory': tmp_path, 'root': root, 'manifest': manifest, 'val_records': val, 'test_records': test,
            'manifest_path': tmp_path / 'manifest.json', 'audit_path': tmp_path / 'audit.json',
            'val_path': tmp_path / 'val.json', 'test_path': tmp_path / 'test.json', 'plan_path': tmp_path / 'plan.json'}


def persist(cohort):
    bench.write_json(cohort['manifest_path'], cohort['manifest'])
    for split in ['val', 'test']:
        bench.write_json(cohort[f'{split}_path'], {
            'schema_version': 'sonri.independent-predictions.v1', 'split': split,
            'manifest_sha256': bench.digest(cohort['manifest']), 'checkpoint_sha256': 'a' * 64,
            'inference_run': {'score_floor': .001, 'max_det': 300, 'pipeline_sha256': 'c' * 64,
                              'evidence_reference': 'SYNTHETIC_PREDICTIONS_ONLY'},
            'records': cohort[f'{split}_records']})


def audited(cohort):
    persist(cohort)
    audit = bench.audit_population(cohort['manifest_path'], cohort['root'], allow_synthetic=True)
    bench.write_json(cohort['audit_path'], audit)
    return audit


def frozen(cohort):
    audited(cohort)
    plan = bench.select_thresholds(cohort['manifest_path'], cohort['root'], cohort['audit_path'], cohort['val_path'], True)
    bench.write_json(cohort['plan_path'], plan)
    return plan


def test_stage(cohort, plan_sha):
    return bench.evaluate_test(cohort['manifest_path'], cohort['root'], cohort['audit_path'], cohort['val_path'],
                               cohort['plan_path'], plan_sha, cohort['test_path'], True)


test_stage.__test__ = False


def test_actual_pixels_validation_freeze_test_errors_and_negative_control(cohort):
    plan = frozen(cohort)
    assert plan['thresholds'] == {'0': .5, '1': .5}
    assert plan['selection_split'] == 'val' and plan['test_predictions_accessed'] is False
    result = test_stage(cohort, plan['content_sha256'])
    assert result['status'] == 'SYNTHETIC_SOFTWARE_TEST_ONLY' and result['clinically_validated'] is False
    metrics = result['metrics']
    zero, one = metrics['per_class']
    assert (zero['tp'], zero['fp'], zero['fn']) == (0, 2, 1)
    assert (one['tp'], one['fp'], one['fn']) == (1, 0, 0)
    assert zero['negative_image_fpr'] == 1 and one['negative_image_fpr'] == 0
    assert metrics['negative_image_fpr_any_class'] == 1
    assert metrics['false_negative_reasons'] == {'CORRECT_LOCATION_BELOW_FROZEN_CLASS_THRESHOLD': 1}
    assert zero['ap50'] > 0  # AP uses raw retained scores; the operating threshold still misses this box.
    public = json.dumps(result)
    for forbidden in ['PRIVATE_FILENAME', 'PRIVATE_REVIEW', 'PRIVATE_CLASS', 'PRIVATE_ATTESTATION',
                      *[row['patient_group'] for row in cohort['manifest']['records']]]:
        assert forbidden not in public


def test_synthetic_requires_explicit_opt_in_and_source17_cannot_be_promoted(cohort):
    persist(cohort)
    with pytest.raises(ValueError, match='SYNTHETIC_FIXTURE_OPT_IN_REQUIRED'):
        bench.audit_population(cohort['manifest_path'], cohort['root'])
    source = Path(__file__).parents[1] / 'source-raw-yolo-reproduction-17.v1.json'
    with pytest.raises(ValueError, match='PRIVATE_DATA_MUST_BE_OUTSIDE_APPLICATION_GIT'):
        bench.audit_population(source, cohort['root'], True)
    private_source = cohort['directory'] / source.name
    private_source.write_bytes(source.read_bytes())
    with pytest.raises(ValueError, match='INDEPENDENT_POPULATION_SCHEMA_REQUIRED'):
        bench.audit_population(private_source, cohort['root'], True)


def test_patient_group_crossing_split_is_rejected_even_with_attestations(cohort):
    cohort['manifest']['records'][4]['patient_group'] = cohort['manifest']['records'][0]['patient_group']
    persist(cohort)
    with pytest.raises(ValueError, match='CROSS_SPLIT_PATIENT_LEAKAGE'):
        bench.audit_population(cohort['manifest_path'], cohort['root'], True)


def test_actual_raw_duplicate_is_rejected_with_different_declared_patients(cohort):
    train, test = cohort['manifest']['records'][0], cohort['manifest']['records'][4]
    (cohort['root'] / test['private_path']).write_bytes((cohort['root'] / train['private_path']).read_bytes())
    test['sha256'] = train['sha256']
    persist(cohort)
    with pytest.raises(ValueError, match='EXACT_RAW_IMAGE_DUPLICATE'):
        bench.audit_population(cohort['manifest_path'], cohort['root'], True)


def test_different_jpeg_bytes_with_same_decoded_pixels_are_rejected(cohort):
    first, second = cohort['manifest']['records'][0], cohort['manifest']['records'][4]
    for row, optimize in [(first, False), (second, True)]:
        row['private_path'] += '.jpg'
        path = cohort['root'] / row['private_path']
        Image.new('RGB', (40, 40), (0, 0, 0)).save(path, 'JPEG', quality=90, optimize=optimize)
        row['sha256'] = hashlib.sha256(path.read_bytes()).hexdigest()
    assert first['sha256'] != second['sha256']
    persist(cohort)
    with pytest.raises(ValueError, match='CANONICAL_RGB_IMAGE_DUPLICATE'):
        bench.audit_population(cohort['manifest_path'], cohort['root'], True)


def test_empty_labels_require_explicit_reviewed_negative(cohort):
    cohort['manifest']['records'][3].pop('reviewed_negative')
    persist(cohort)
    with pytest.raises(ValueError, match='EMPTY_LABELS_REQUIRE_EXPLICIT_REVIEWED_NEGATIVE'):
        bench.audit_population(cohort['manifest_path'], cohort['root'], True)


def test_uncertain_near_duplicate_is_not_auto_equal_or_auto_cleared(cohort):
    train, test = cohort['manifest']['records'][0], cohort['manifest']['records'][4]
    for row, color in [(train, (20, 20, 20)), (test, (220, 80, 20))]:
        path = cohort['root'] / row['private_path']
        Image.new('RGB', (40, 40), color).save(path)
        row['sha256'] = hashlib.sha256(path.read_bytes()).hexdigest()
    audit = audited(cohort)
    assert audit['status'] == 'BLOCKED_NEAR_DUPLICATE_REVIEW'
    candidates = audit['cross_split_near_duplicate_candidates']
    assert len(candidates) == 1 and candidates[0]['dhash_hamming'] == 0
    assert candidates[0]['resolution'] == 'BLOCKED_REVIEW_REQUIRED'
    with pytest.raises(ValueError, match='AUDIT_NOT_APPROVED'):
        bench.select_thresholds(cohort['manifest_path'], cohort['root'], cohort['audit_path'], cohort['val_path'], True)
    review = {'pair': candidates[0]['pair'], 'raw_sha256_pair': sorted([train['sha256'], test['sha256']]),
              'decision': 'DISTINCT_IMAGES', 'reviewed': True, 'independent_reviewer_confirmed': True,
              'evidence_reference': 'SYNTHETIC_INDEPENDENT_NEAR_PAIR_REVIEW_ONLY'}
    cohort['manifest']['near_duplicate_reviews'] = [review]
    assert audited(cohort)['status'] == 'AUDIT_PASSED'
    review['raw_sha256_pair'] = ['0' * 64, '1' * 64]
    persist(cohort)
    with pytest.raises(ValueError, match='STALE_NEAR_DUPLICATE_REVIEW'):
        bench.audit_population(cohort['manifest_path'], cohort['root'], True)


def test_threshold_selection_rejects_test_predictions_or_foreign_test_records(cohort):
    audited(cohort)
    with pytest.raises(ValueError, match='PREDICTION_SPLIT_MISMATCH'):
        bench.select_thresholds(cohort['manifest_path'], cohort['root'], cohort['audit_path'], cohort['test_path'], True)
    wrong = bench.read_json(cohort['val_path'])
    wrong['records'].update(cohort['test_records'])
    bench.write_json(cohort['val_path'], wrong)
    with pytest.raises(ValueError, match='PREDICTION_IMAGE_SET_MISMATCH'):
        bench.select_thresholds(cohort['manifest_path'], cohort['root'], cohort['audit_path'], cohort['val_path'], True)


def test_frozen_threshold_tamper_is_rejected_even_if_content_seal_is_recomputed(cohort):
    plan = frozen(cohort)
    old_sha = plan.pop('content_sha256')
    plan['thresholds']['0'] = .9
    edited = bench.seal(plan)
    bench.write_json(cohort['plan_path'], edited)
    with pytest.raises(ValueError, match='FROZEN_THRESHOLD_PLAN_SHA256_MISMATCH'):
        test_stage(cohort, old_sha)
    with pytest.raises(ValueError, match='THRESHOLD_PLAN_NOT_DERIVED_FROM_BOUND_VALIDATION'):
        test_stage(cohort, edited['content_sha256'])


def test_val_prediction_manifest_and_pixel_tamper_require_fresh_audit_or_plan(cohort):
    plan = frozen(cohort)
    val = bench.read_json(cohort['val_path'])
    first = cohort['manifest']['records'][1]['record_id']
    val['records'][first][0]['score'] = .95
    bench.write_json(cohort['val_path'], val)
    with pytest.raises(ValueError, match='THRESHOLD_PLAN_NOT_DERIVED_FROM_BOUND_VALIDATION'):
        test_stage(cohort, plan['content_sha256'])
    persist(cohort)
    cohort['manifest']['records'][4]['annotations'][0]['box'] = [.2, .2, .45, .45]
    persist(cohort)
    with pytest.raises(ValueError, match='AUDIT_STALE_OR_POPULATION_CHANGED'):
        test_stage(cohort, plan['content_sha256'])
    cohort['manifest']['records'][4]['annotations'][0]['box'] = BOXES[0]
    persist(cohort)
    Image.new('RGB', (40, 40), (22, 33, 44)).save(cohort['root'] / cohort['manifest']['records'][4]['private_path'])
    with pytest.raises(ValueError, match='IMAGE_RAW_SHA256_MISMATCH'):
        test_stage(cohort, plan['content_sha256'])


def test_prediction_provenance_missing_train_population_and_path_escape_rejected(cohort, tmp_path):
    plan = frozen(cohort)
    wrong = bench.read_json(cohort['test_path'])
    wrong['checkpoint_sha256'] = 'b' * 64
    bench.write_json(cohort['test_path'], wrong)
    with pytest.raises(ValueError, match='PREDICTION_PROVENANCE_MISMATCH'):
        test_stage(cohort, plan['content_sha256'])
    cohort['manifest']['records'][0]['private_path'] = '../outside.png'
    Image.new('RGB', (40, 40), (22, 33, 44)).save(tmp_path / 'outside.png')
    persist(cohort)
    with pytest.raises(ValueError, match='IMAGE_PATH_ESCAPE_OR_MISSING_FILE'):
        bench.audit_population(cohort['manifest_path'], cohort['root'], True)
    cohort['manifest']['records'] = [row for row in cohort['manifest']['records'] if row['split'] != 'train']
    persist(cohort)
    with pytest.raises(ValueError, match='ALL_TRAIN_VAL_TEST_POPULATIONS_REQUIRED'):
        bench.audit_population(cohort['manifest_path'], cohort['root'], True)


def test_val_and_test_must_keep_same_detector_retention_contract(cohort):
    plan = frozen(cohort)
    test = bench.read_json(cohort['test_path'])
    test['inference_run']['max_det'] = 600
    bench.write_json(cohort['test_path'], test)
    with pytest.raises(ValueError, match='VALIDATION_TEST_INFERENCE_CONTRACT_MISMATCH'):
        test_stage(cohort, plan['content_sha256'])


def test_cli_three_stages_execute_without_public_private_identifiers(cohort):
    persist(cohort)
    script = str(Path(bench.__file__))
    common = ['--manifest', str(cohort['manifest_path']), '--private-images', str(cohort['root']),
              '--allow-synthetic-software-fixtures']
    audited = subprocess.run([sys.executable, script, 'audit', *common, '--output', str(cohort['audit_path'])],
                             capture_output=True, text=True)
    assert audited.returncode == 0 and json.loads(audited.stdout)['status'] == 'AUDIT_PASSED'
    selected = subprocess.run([sys.executable, script, 'select-thresholds', *common, '--audit', str(cohort['audit_path']),
                               '--validation-predictions', str(cohort['val_path']), '--output', str(cohort['plan_path'])],
                              capture_output=True, text=True)
    assert selected.returncode == 0
    plan_sha = json.loads(selected.stdout)['content_sha256']
    tested = subprocess.run([sys.executable, script, 'test', *common, '--audit', str(cohort['audit_path']),
                             '--validation-predictions', str(cohort['val_path']), '--threshold-plan', str(cohort['plan_path']),
                             '--frozen-plan-sha256', plan_sha, '--test-predictions', str(cohort['test_path']),
                             '--output', str(cohort['directory'] / 'software-result.json')], capture_output=True, text=True)
    assert tested.returncode == 0 and json.loads(tested.stdout)['status'] == 'SYNTHETIC_SOFTWARE_TEST_ONLY'
    assert 'PRIVATE_' not in audited.stdout + selected.stdout + tested.stdout


def test_private_manifest_cannot_live_in_application_git_or_unignored_parent_git(cohort):
    persist(cohort)
    with tempfile.TemporaryDirectory(prefix='.independent-software-privacy-', dir=bench.APP_ROOT) as directory:
        inside = Path(directory) / 'synthetic-manifest.json'
        bench.write_json(inside, cohort['manifest'])
        with pytest.raises(ValueError, match='PRIVATE_DATA_MUST_BE_OUTSIDE_APPLICATION_GIT'):
            bench.load_manifest(inside, True)
    outer = cohort['directory'] / 'synthetic-outer-repo'
    outer.mkdir()
    subprocess.run(['git', 'init', '-q', str(outer)], check=True, capture_output=True)
    folder = outer / 'private-only'
    folder.mkdir()
    inside = folder / 'manifest.json'
    bench.write_json(inside, cohort['manifest'])
    with pytest.raises(ValueError, match='PRIVATE_IMAGE_DIRECTORY_NOT_IGNORED_BY_PARENT_GIT'):
        bench.load_manifest(inside, True)
    (outer / '.gitignore').write_text('/private-only/\n')
    assert bench.load_manifest(inside, True)['data_kind'] == 'SYNTHETIC_SOFTWARE_FIXTURE'


@pytest.mark.parametrize('split', ['val', 'test'])
def test_both_validation_and_test_require_explicit_reviewed_negative_controls(cohort, split):
    cohort['manifest']['records'] = [row for row in cohort['manifest']['records'] if not (row['split'] == split and not row['annotations'])]
    persist(cohort)
    with pytest.raises(ValueError, match='REVIEWED_NEGATIVE_CONTROL_REQUIRED_FOR_VAL_AND_TEST'):
        bench.audit_population(cohort['manifest_path'], cohort['root'], True)
