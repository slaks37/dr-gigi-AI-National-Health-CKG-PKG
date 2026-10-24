"""Acquire only the frozen, licensed 17-image original-test/source-test intersection.

This is source-test reproduction, never external clinical validation. The record
and publication establish public research use; retain attribution. Metadata,
source filenames and image bytes remain in --private-dir outside Git.
"""
import argparse
import hashlib
import json
import os
from collections import Counter
from pathlib import Path
import urllib.request

from remote_zip import RemoteZip
from evaluate import resolve_coco_category_ids

SOURCE_COMMIT = 'f02596a0227b9eaf767b955cd67196236111a3d5'
CHECKPOINT_SHA = '7d5f7dcf616f1febbbb28f2552f9d8a2c3e31e90b3c5b03bf26114502dea621d'
DATASET_URL = 'https://zenodo.org/api/records/14827784/files/Benchmarking%20Dataset.zip/content'
PAPER = 'https://doi.org/10.1038/s41597-025-05647-9'
LICENSE_EVIDENCE = 'https://zenodo.org/api/records/14827784'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--private-dir', type=Path, required=True)
    parser.add_argument('--acknowledge-public-research-license', action='store_true', required=True)
    args = parser.parse_args()
    folder = args.private_dir.resolve()
    repository = Path(__file__).resolve().parents[2]
    if folder.is_relative_to(repository):
        raise ValueError('PRIVATE_DATA_MUST_REMAIN_OUTSIDE_REPOSITORY')
    folder.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(folder, 0o700)
    req = urllib.request.Request(f'https://api.github.com/repos/slaks37/dental_study/git/trees/{SOURCE_COMMIT}?recursive=1', headers={'User-Agent': 'SONRI-research-provenance/1.0'})
    with urllib.request.urlopen(req, timeout=60) as response:
        tree_bytes = response.read()
    tree = json.loads(tree_bytes)
    if tree.get('truncated'):
        raise ValueError('SOURCE_TREE_INCOMPLETE')
    (folder / 'daath-tree.json').write_bytes(tree_bytes)
    test_stems = {Path(item['path']).stem for item in tree['tree'] if item['path'].startswith('yolo_split/labels/test/')}
    training_stems = {Path(item['path']).stem for item in tree['tree'] if item['path'].startswith(('yolo_split/labels/train/', 'yolo_split/labels/val/'))}
    archive = RemoteZip(DATASET_URL, 1569536122)
    annotation_bytes = archive.extract('Benchmarking Dataset/test/coco/test.json')
    (folder / 'official-test-coco.json').write_bytes(annotation_bytes)
    coco = json.loads(annotation_bytes)
    # IMPORTANT: category IDs differ between train/valid/test in this source.
    names = {int(row['id']): row['name'] for row in coco['categories']}
    if set(names.values()) != {'d', 'D'}:
        raise ValueError('UNEXPECTED_SOURCE_CLASS_NAMES')
    category_ids = resolve_coco_category_ids(coco['categories'], {0: 'd', 1: 'D'})
    selected = sorted((image for image in coco['images'] if Path(image['file_name']).stem in test_stems), key=lambda x: x['file_name'])
    if len(selected) != 17:
        raise ValueError('FROZEN_SELECTION_COUNT_CHANGED')
    images = []
    for index, image in enumerate(selected):
        filename = Path(image['file_name']).name
        if Path(filename).stem in training_stems:
            raise ValueError('SOURCE_TRAIN_TEST_IMAGE_ID_OVERLAP')
        payload = archive.extract('Benchmarking Dataset/test/images/' + filename)
        digest = hashlib.sha256(payload).hexdigest()
        local = folder / (digest + '.jpg')
        local.write_bytes(payload)
        os.chmod(local, 0o600)
        annotations = []
        for row in coco['annotations']:
            if row['image_id'] != image['id']:
                continue
            if int(row.get('ignore', 0)) or int(row.get('iscrowd', 0)):
                raise ValueError('UNSUPPORTED_CROWD_OR_IGNORED_REFERENCE')
            x, y, width, height = row['bbox']
            box = [x / image['width'], y / image['height'], (x + width) / image['width'], (y + height) / image['height']]
            if any(value < 0 or value > 1 for value in box):
                raise ValueError('SOURCE_BOX_OUT_OF_BOUNDS')
            annotations.append({'class_id': category_ids[row['category_id']], 'box': box})
        images.append({'path': str(local), 'sha256': digest, 'width': image['width'], 'height': image['height'], 'source_filename': filename, 'patient_group': None, 'annotation_verified': True, 'annotation_basis': 'Published dentist-reviewed dataset reference; no new SONRI clinician adjudication', 'annotations': annotations})
        print(f'acquired licensed source record {index + 1}/{len(selected)}', flush=True)
    manifest = {'schema_version': 'sonri.evaluation-cohort.v1', 'checkpoint_sha256': CHECKPOINT_SHA, 'class_names': {'0': 'd', '1': 'D'}, 'provenance': {'dataset_id': 'zenodo.14827784', 'dataset_version': 'v1', 'license': 'CC-BY-4.0 per current official repository record', 'license_evidence': LICENSE_EVIDENCE, 'clinical_annotation_evidence': PAPER, 'modality': 'intraoral-occlusal', 'attribution': 'Faizan Ahmed SM, Ghori MH, Khalid A, Nooruddin A, Adnan N, Lal A, Umer F. Annotated intraoral image dataset for dental caries detection. Scientific Data 12, 1297 (2025). DOI 10.1038/s41597-025-05647-9; dataset DOI 10.5281/zenodo.14827784.', 'selection': 'Complete intersection of original Benchmarking test COCO-referenced records and exact Daath yolo_split/labels/test stems at pinned commit; 17 records; no performance-based selection.', 'source_commit': SOURCE_COMMIT, 'annotation_sha256': hashlib.sha256(annotation_bytes).hexdigest(), 'archive_md5_from_record': '852520f16faf65f4704ee06bd82561fa', 'full_archive_md5_verified': False, 'member_integrity': 'HTTP Content-Range checked; ZIP CRC32 checked and per-image SHA256 frozen', 'class_id_resolution': 'Use each COCO file category.name; official test 1=D,2=d differs from train/valid 1=d,2=D.'}, 'leakage_audit': {'patient_identity_verified': False, 'train_test_patient_disjoint': False, 'exact_duplicates_checked': False, 'near_duplicates_adjudicated': False, 'training_population_complete': False, 'evidence_reference': 'docs/validation/dataset-eligibility.v1.json', 'source_image_ids_train_val_test_disjoint_for_selection': True}, 'images': images}
    (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    os.chmod(folder / 'manifest.json', 0o600)
    print(json.dumps({'selected_images': len(images), 'reference_boxes': dict(Counter(a['class_id'] for image in images for a in image['annotations'])), 'patient_split_audited': False}))


if __name__ == '__main__':
    main()
