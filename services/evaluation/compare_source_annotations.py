"""Compare authoritative annotation formats independently of model predictions.

Resolve by box geometry and explicit source labels, never by visual interpretation
or detector behavior. Keep source patient IDs and bytes outside the repository.
"""
import argparse
import copy
import hashlib
import json
from collections import Counter
from pathlib import Path
import urllib.request
from evaluate import iou
from remote_zip import RemoteZip

COMMIT = 'f02596a0227b9eaf767b955cd67196236111a3d5'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--private-manifest', type=Path, required=True)
    parser.add_argument('--evidence-output', type=Path, required=True)
    args = parser.parse_args()
    manifest = json.loads(args.private_manifest.read_text())
    archive = RemoteZip('https://zenodo.org/api/records/14827784/files/Benchmarking%20Dataset.zip/content', 1569536122)
    pairs, images, labelme_pairs = Counter(), [], Counter()
    discrepancies = []
    raw_manifest = copy.deepcopy(manifest)
    raw_manifest['class_names'] = {'0': 'RAW_TRAINING_CLASS_0', '1': 'RAW_TRAINING_CLASS_1'}
    raw_manifest['provenance']['reference_protocol'] = 'Exact raw YOLO training class IDs, independently byte-compared to pinned source test annotations. Disease semantics UNVERIFIED because source class-name contract conflicts with cross-format annotation content.'
    for index, image in enumerate(raw_manifest['images']):
        stem = Path(image['source_filename']).stem
        official = archive.extract('Benchmarking Dataset/test/yolo/' + stem + '.txt')
        url = f'https://raw.githubusercontent.com/slaks37/dental_study/{COMMIT}/yolo_split/labels/test/{stem}.txt'
        with urllib.request.urlopen(url, timeout=60) as response:
            source = response.read()
        if official != source:
            raise ValueError('SOURCE_YOLO_LABEL_BYTES_DIFFER')
        labelme_bytes = archive.extract('Benchmarking Dataset/test/labelme/' + stem + '.json')
        labelme = json.loads(labelme_bytes)
        raw_annotations = []
        matched = set()
        row_pairs, geometry = [], []
        for line in official.decode().splitlines():
            cid, cx, cy, width, height = map(float, line.split())
            if cid not in {0, 1}:
                raise ValueError('UNKNOWN_RAW_CLASS')
            box = [cx-width/2, cy-height/2, cx+width/2, cy+height/2]
            raw_annotations.append({'class_id': int(cid), 'box': box})
            candidates = [(iou(box, gt['box']), j, manifest['class_names'][str(gt['class_id'])]) for j, gt in enumerate(image['annotations']) if j not in matched]
            overlap, j, name = max(candidates)
            if overlap >= .98:
                matched.add(j)
                pairs[f'raw_{int(cid)}->COCO_{name}'] += 1
            else:
                discrepancies.append({'image_sha256': image['sha256'], 'kind': 'COCO_YOLO_GEOMETRY_DIFFERS', 'raw_class_id': int(cid), 'best_reference_iou': overlap})
            row_pairs.append({'raw_yolo_class_id': int(cid), 'coco_category_name': name if overlap >= .98 else None, 'box_iou': overlap})
            for shape in labelme['shapes']:
                xs=[p[0]/labelme['imageWidth'] for p in shape['points']]
                ys=[p[1]/labelme['imageHeight'] for p in shape['points']]
                lbox=[min(xs),min(ys),max(xs),max(ys)]
                if iou(box,lbox) >= .98:
                    labelme_pairs[f'raw_{int(cid)}->LabelMe_{shape["label"]}'] += 1
                    row_pairs[-1]['labelme_class_name']=shape['label']
                    break
            else:
                discrepancies.append({'image_sha256': image['sha256'], 'kind': 'LABELME_YOLO_GEOMETRY_DIFFERS', 'raw_class_id': int(cid)})
        if len(matched) != len(image['annotations']):
            discrepancies.append({'image_sha256': image['sha256'], 'kind': 'UNMATCHED_COCO_REFERENCE_BOXES', 'count': len(image['annotations']) - len(matched)})
        image['annotations'] = raw_annotations
        image['source_yolo_sha256'] = hashlib.sha256(source).hexdigest()
        image['annotation_basis'] = 'Exact source raw training class index, cross-format semantic contradiction unresolved'
        images.append({'image_sha256': image['sha256'], 'official_yolo_sha256': hashlib.sha256(official).hexdigest(), 'pinned_daath_yolo_sha256': hashlib.sha256(source).hexdigest(), 'official_labelme_sha256': hashlib.sha256(labelme_bytes).hexdigest(), 'all_yolo_bytes_identical': True, 'matched_boxes': row_pairs})
        print(f'compared annotation record {index + 1}/{len(raw_manifest["images"])}', flush=True)
    result = {'schema_version': 'sonri.cross-format-annotation-audit.v1', 'clinical_use': 'PROHIBITED', 'source_commit': COMMIT, 'dataset_id': 'zenodo.14827784.v1', 'comparison_uses_predictions': False, 'comparison': 'Exact original-test YOLO bytes vs pinned Daath test YOLO bytes; normalized geometry matching IoU >=0.98 against official original-test COCO and LabelMe names.', 'images': images, 'cross_format_pairs': dict(pairs), 'labelme_pairs': dict(labelme_pairs), 'geometry_discrepancies': discrepancies, 'status': 'CLASS_CONTRACT_CONFLICT', 'checkpoint_declared_names': {'0': 'd', '1': 'D'}, 'conclusion': 'Raw training-index reproduction is permissible; disease meaning cannot be verified from the conflicting declared class-name contract. Never repair semantics using detector behavior.'}
    reference_audit = {'semantic_label_mapping_verified': False, 'reference_class_contract_verified': False, 'independent_reference_review_verified': False, 'class_contract_conflict': True, 'evidence_reference': 'docs/validation/dataset-cross-format-audit.v1.json'}
    manifest['reference_audit'] = reference_audit
    raw_manifest['reference_audit'] = reference_audit
    args.evidence_output.write_text(json.dumps(result, indent=2) + '\n')
    args.private_manifest.write_text(json.dumps(manifest, indent=2) + '\n')
    args.private_manifest.with_name('manifest-raw-yolo.json').write_text(json.dumps(raw_manifest, indent=2) + '\n')
    print(json.dumps({'cross_format_pairs': dict(pairs), 'labelme_pairs': dict(labelme_pairs)}))


if __name__ == '__main__':
    main()
