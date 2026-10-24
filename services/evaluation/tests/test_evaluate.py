import copy
import math
import sys
from pathlib import Path

import pytest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from evaluate import audit_manifest, evaluate, iou


def test_perfect_and_duplicate_predictions_and_absent_class():
    images = [{'id': 'a', 'annotations': [{'class_id': 0, 'box': [0, 0, .5, .5]}], 'predictions': [{'class_id': 0, 'box': [0, 0, .5, .5], 'score': .9}, {'class_id': 0, 'box': [0, 0, .5, .5], 'score': .8}, {'class_id': 1, 'box': [.5, .5, 1, 1], 'score': .7}]}]
    r = evaluate(images, {0: 'd', 1: 'D'})['per_class']
    assert (r[0]['tp'], r[0]['fp'], r[0]['fn']) == (1, 1, 0)
    assert r[0]['ap50'] == 1 and r[0]['precision'] == .5
    assert r[1]['ap50'] is None and r[1]['recall'] is None and r[1]['fp'] == 1


def test_localization_and_wrong_class_fn_evidence():
    images = [{'id': 'a', 'annotations': [{'class_id': 0, 'box': [0, 0, .4, .4]}, {'class_id': 1, 'box': [.5, .5, 1, 1]}], 'predictions': [{'class_id': 1, 'box': [0, 0, .4, .4], 'score': .9}, {'class_id': 1, 'box': [.7, .7, 1, 1], 'score': .8}]}]
    r = evaluate(images, {0: 'd', 1: 'D'})
    assert r['false_negative_reasons'] == {'WRONG_CLASS_AT_REFERENCE_LOCATION': 1, 'LOCALIZATION_IOU_BELOW_THRESHOLD': 1}
    assert r['per_class'][1]['fn'] == 1 and r['per_class'][1]['fp'] == 2


def test_below_threshold_still_enters_ap_curve():
    r = evaluate([{'id': 'a', 'annotations': [{'class_id': 0, 'box': [0, 0, 1, 1]}], 'predictions': [{'class_id': 0, 'box': [0, 0, 1, 1], 'score': .1}]}], {0: 'd'})
    assert r['per_class'][0]['fn'] == 1 and r['per_class'][0]['ap50'] == 1
    assert r['false_negative_reasons'] == {'CORRECT_LOCATION_BELOW_CONFIDENCE_THRESHOLD': 1}


@pytest.mark.parametrize('bad', [float('nan'), float('inf'), -1, 1.01, True])
def test_invalid_scores_refused(bad):
    with pytest.raises(ValueError, match='INVALID_SCORE'):
        evaluate([{'id': 'a', 'annotations': [], 'predictions': [{'class_id': 0, 'box': [0, 0, 1, 1], 'score': bad}]}], {0: 'd'})


def manifest():
    return {'checkpoint_sha256': 'a' * 64, 'provenance': dict(dataset_id='d', dataset_version='v1', license='CC-BY-4.0', license_evidence='public record', clinical_annotation_evidence='published dentist annotations', modality='intraoral'), 'images': [{'sha256': 'b' * 64, 'annotation_verified': True, 'annotations': [], 'patient_group': 'synthetic-patient'}]}


def test_source_reproduction_cannot_be_promoted_to_independent_evidence():
    r = audit_manifest(manifest(), 'a' * 64, 'source-reproduction')
    assert not r['patient_split_audited'] and r['status'] == 'SOURCE_REPRODUCTION_ONLY'
    with pytest.raises(ValueError, match='INDEPENDENT_BENCHMARK_BLOCKED'):
        audit_manifest(manifest(), 'a' * 64, 'independent-benchmark')


def test_missing_annotation_is_not_assumed_negative():
    m = manifest(); del m['images'][0]['annotations']
    with pytest.raises(ValueError, match='REFERENCE_EVIDENCE_INCOMPLETE'):
        audit_manifest(m, 'a' * 64, 'source-reproduction')


def test_patient_split_attestation_cannot_hide_unresolved_reference_contract():
    m = manifest()
    m['leakage_audit'] = {key: True for key in ['patient_identity_verified', 'train_test_patient_disjoint', 'exact_duplicates_checked', 'near_duplicates_adjudicated', 'training_population_complete']}
    m['leakage_audit']['evidence_reference'] = 'synthetic frozen population'
    m['split_population'] = [{'split': 'test', 'patient_group': 'synthetic-patient', 'sha256': 'b' * 64}]
    with pytest.raises(ValueError, match='SEMANTIC_LABEL_MAPPING_VERIFIED_UNVERIFIED'):
        audit_manifest(m, 'a' * 64, 'independent-benchmark')
    m['reference_audit'] = {'semantic_label_mapping_verified': True, 'reference_class_contract_verified': True, 'independent_reference_review_verified': True, 'evidence_reference': 'synthetic fixture, not a clinical approval'}
    assert audit_manifest(m, 'a' * 64, 'independent-benchmark')['status'] == 'AUDIT_PASSED'
    m['reference_audit']['class_contract_conflict'] = True
    with pytest.raises(ValueError, match='REFERENCE_CLASS_CONTRACT_CONFLICT'):
        audit_manifest(m, 'a' * 64, 'independent-benchmark')


def test_duplicate_hash_and_wrong_checkpoint_refused():
    m = manifest(); m['images'].append(copy.deepcopy(m['images'][0]))
    with pytest.raises(ValueError, match='DUPLICATE_TEST_IMAGE_HASH'):
        audit_manifest(m, 'a' * 64, 'source-reproduction')
    with pytest.raises(ValueError, match='CHECKPOINT_MANIFEST_MISMATCH'):
        audit_manifest(manifest(), 'c' * 64, 'source-reproduction')


def test_checkpoint_metadata_never_executes_pickled_globals(tmp_path):
    import hashlib
    import pickle
    import zipfile
    from inspect_checkpoint import inspect
    marker = tmp_path / 'must-not-exist'
    class Exploit:
        def __reduce__(self):
            import os
            return os.system, (f'touch {marker}',)
    archive = tmp_path / 'fake.pt'
    with zipfile.ZipFile(archive, 'w') as z:
        z.writestr('checkpoint/data.pkl', pickle.dumps({'model': Exploit(), 'args': {'class_names': None}}, protocol=2))
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    assert inspect(archive, digest)['training']['class_names'] is None
    assert not marker.exists()
    with pytest.raises(ValueError, match='CHECKPOINT_SHA256_MISMATCH'):
        inspect(archive, 'f' * 64)


@pytest.mark.parametrize('field', ['patient_group', 'sha256', 'duplicate_group', 'near_duplicate_group'])
def test_frozen_population_leakage_rejected_even_with_all_attestations(field):
    m = manifest()
    m['leakage_audit'] = {key: True for key in ['patient_identity_verified', 'train_test_patient_disjoint', 'exact_duplicates_checked', 'near_duplicates_adjudicated', 'training_population_complete']}
    m['leakage_audit']['evidence_reference'] = 'clinician-reviewed frozen population'
    test = {'split': 'test', 'patient_group': 'synthetic-patient', 'sha256': 'b' * 64, 'duplicate_group': 'g1', 'near_duplicate_group': 'n1'}
    train = {'split': 'train', 'patient_group': 'other-patient', 'sha256': 'c' * 64, 'duplicate_group': 'g2', 'near_duplicate_group': 'n2'}
    train[field] = test[field]
    m['split_population'] = [test, train]
    with pytest.raises(ValueError, match='CROSS_SPLIT_LEAKAGE'):
        audit_manifest(m, 'a' * 64, 'independent-benchmark')


def test_coco_category_order_is_local_to_split_not_assumed_numeric():
    from evaluate import resolve_coco_category_ids
    assert resolve_coco_category_ids([{'id': 1, 'name': 'D'}, {'id': 2, 'name': 'd'}], {0: 'd', 1: 'D'}) == {1: 1, 2: 0}
    assert resolve_coco_category_ids([{'id': 1, 'name': 'd'}, {'id': 2, 'name': 'D'}], {0: 'd', 1: 'D'}) == {1: 0, 2: 1}
    with pytest.raises(ValueError, match='UNKNOWN_OR_DUPLICATE_COCO_CATEGORY'):
        resolve_coco_category_ids([{'id': 0, 'name': 'unsupported clinical label'}], {0: 'd', 1: 'D'})
