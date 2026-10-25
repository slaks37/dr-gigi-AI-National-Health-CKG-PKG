"""Read-only annotation provenance audit for the pinned Daath source.

No images, checkpoints, converters, training code or model inference are executed.
Only aggregate evidence and annotation hashes leave the operator's private sparse
checkout. Observed class associations never authorize a disease mapping.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import hashlib
import json
import math
from pathlib import Path
import subprocess

COMMIT = 'f02596a0227b9eaf767b955cd67196236111a3d5'
INITIAL_COMMIT = '3876e982997375df2535904e700136e2e26e1eaf'
CHECKPOINT_SHA256 = '7d5f7dcf616f1febbbb28f2552f9d8a2c3e31e90b3c5b03bf26114502dea621d'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def overlap(a, b):
    area = max(0, min(a[2], b[2]) - max(a[0], b[0])) * max(0, min(a[3], b[3]) - max(a[1], b[1]))
    union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - area
    return area / union if union else 0


def parse_yolo(data):
    result = []
    for line in data.decode('utf-8-sig').splitlines():
        if not line.strip():
            continue
        values = line.split()
        if len(values) != 5:
            raise ValueError('INVALID_YOLO_ROW_LENGTH')
        cid, cx, cy, w, h = map(float, values)
        if not all(math.isfinite(v) for v in (cid, cx, cy, w, h)) or cid != int(cid) or int(cid) not in {0, 1} or not (0 <= cx <= 1 and 0 <= cy <= 1 and 0 < w <= 1 and 0 < h <= 1):
            raise ValueError('INVALID_YOLO_ROW')
        result.append((int(cid), [cx-w/2, cy-h/2, cx+w/2, cy+h/2]))
    return result


def coco_records(path):
    data = json.loads(path.read_bytes())
    names = {int(c['id']): c['name'] for c in data['categories']}
    if set(names.values()) != {'d', 'D'}:
        raise ValueError('UNEXPECTED_COCO_SOURCE_NAMES')
    annotations = defaultdict(list)
    for row in data['annotations']:
        annotations[row['image_id']].append(row)
    records = []
    for image in data['images']:
        boxes = []
        for row in annotations[image['id']]:
            x, y, w, h = row['bbox']
            boxes.append((names[row['category_id']], [x/image['width'], y/image['height'], (x+w)/image['width'], (y+h)/image['height']]))
        records.append((Path(image['file_name']).stem, boxes))
    return names, records


def compare_annotation_tree(source_root):
    original = defaultdict(list)
    for path in sorted((source_root / 'Dataset/Annotations/Darknet_YOLO').rglob('*.txt')):
        original[path.stem].append(digest(path.read_bytes()))
    coco = defaultdict(list)
    category_orders, coco_hashes = {}, {}
    for split in ['train', 'valid', 'test']:
        path = source_root / 'Dataset/Annotations/MS_coco' / (split + '.json')
        names, records = coco_records(path)
        category_orders[split] = names
        coco_hashes[split] = digest(path.read_bytes())
        for stem, boxes in records:
            coco[stem].append((split, boxes))
    summaries = {}
    fingerprints = []
    samples = []
    for split in ['train', 'val', 'test']:
        counts, raw_counts, associations, low_iou = Counter(), Counter(), Counter(), Counter()
        all_iou98 = Counter()
        for path in sorted((source_root / 'yolo_split/labels' / split).glob('*.txt')):
            content = path.read_bytes()
            sha = digest(content)
            fingerprints.append((str(path.relative_to(source_root)), sha))
            rows = parse_yolo(content)
            counts['files'] += 1
            counts['empty_label_files'] += not bool(rows)
            raw_counts.update(cid for cid, _ in rows)
            origin = set(original.get(path.stem, []))
            if not origin:
                counts['no_original_yolo_stem'] += 1
            elif len(origin) > 1:
                counts['ambiguous_original_stem_with_distinct_bytes'] += 1
            elif sha in origin:
                counts['byte_identical_original_yolo'] += 1
            else:
                counts['different_original_yolo_bytes'] += 1
            references = coco.get(path.stem, [])
            if not references:
                counts['no_coco_reference_stem'] += 1
                continue
            if len(references) != 1:
                counts['multiple_coco_references'] += 1
                continue
            reference_partition, boxes = references[0]
            used = set()
            sample_associations = []
            for cid, box in rows:
                candidates = [(overlap(box, gt), j, name) for j, (name, gt) in enumerate(boxes) if j not in used]
                best, j, name = max(candidates, default=(0, -1, 'UNMATCHED'))
                if best < .95:
                    low_iou[str(cid)] += 1
                    continue
                used.add(j)
                key = f'raw_{cid}->COCO_{name}'
                associations[key] += 1
                if best >= .98:
                    all_iou98[key] += 1
                sample_associations.append({'raw_class_id': cid, 'coco_name': name, 'geometry_iou': best})
            counts['unmatched_coco_boxes_at_iou095'] += len(boxes) - len(used)
            if len([x for x in samples if x['daath_split'] == split]) < 3:
                samples.append({'daath_split': split, 'annotation_sha256': sha, 'reference_coco_partition': reference_partition, 'matched_associations': sample_associations})
        summaries[split] = {'counts': dict(counts), 'raw_annotation_box_counts': dict(raw_counts), 'geometry_associations_iou095': dict(associations), 'geometry_associations_iou098': dict(all_iou98), 'unmatched_yolo_boxes_at_iou095': dict(low_iou)}
    serial = '\n'.join(path + '\0' + sha for path, sha in sorted(fingerprints)).encode()
    return {'status': 'UNVERIFIED_CONTRACT_CONFLICT', 'clinical_use': 'PROHIBITED', 'clinical_approval': False, 'disease_mapping_authorized': False, 'class_bindings': [], 'images_read': 0, 'model_runs': 0, 'training_runs': 0, 'method': 'Full pinned annotation-text traversal; byte comparison with original YOLO files and one-to-one geometry association with per-file COCO category names. Associations are descriptive evidence only.', 'training_annotation_manifest_sha256': digest(serial), 'training_annotation_manifest_formula': 'SHA256 of sorted relative source label paths plus NUL plus file SHA256, joined by newline; source paths remain private.', 'original_yolo_unique_stems': len(original), 'original_yolo_files': sum(len(v) for v in original.values()), 'coco_category_orders': category_orders, 'coco_file_sha256': coco_hashes, 'source_splits': summaries, 'representative_annotation_evidence': samples, 'limitations': ['COCO and YOLO are conversions of the same source annotations, not independent clinical reference standards.', 'Filenames alone do not prove patient identity or independence. Empty labels do not prove health.', 'Geometry matching can omit small/changed/overlapping boxes; all unmatched counts remain explicit.', 'No converter revision, source-author adjudication or signed full checkpoint training export has been recovered; associations do not authorize an inverse mapping.']}


def git(source, *args):
    return subprocess.check_output(['git', '-c', 'filter.lfs.process=', '-c', 'filter.lfs.required=false', '-c', 'filter.lfs.smudge=', '-c', 'filter.lfs.clean=', '-C', str(source), *args], text=True).strip()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-root', type=Path, required=True, help='Private annotation-only sparse checkout; no network operation is performed')
    parser.add_argument('--checkpoint', type=Path, help='Optional exact audited local artifact for fresh inert metadata inspection')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    source = args.source_root.resolve()
    if git(source, 'rev-parse', 'HEAD') != COMMIT:
        raise ValueError('PINNED_SOURCE_COMMIT_REQUIRED')
    checked_paths = ['Dataset/classes.txt', 'Dataset/Annotations/Darknet_YOLO', 'Dataset/Annotations/MS_coco', 'yolo_split/labels', 'yolo_split/data.yaml', 'colab.ipynb', 'prepare_data.py', 'train_yolo.py']
    if git(source, 'status', '--porcelain', '--', *checked_paths):
        raise ValueError('SOURCE_ANNOTATIONS_OR_CONFIG_MODIFIED')
    result = compare_annotation_tree(source)
    result.update(schema_version='sonri.phase3-label-provenance.v1', verified_on='2026-10-25', source_commit=COMMIT, source_url=f'https://github.com/slaks37/dental_study/tree/{COMMIT}', initial_commit=INITIAL_COMMIT)
    result['configuration_evidence'] = []
    for path in ['Dataset/classes.txt', 'yolo_split/data.yaml', 'colab.ipynb', 'prepare_data.py', 'train_yolo.py']:
        content = (source / path).read_bytes()
        history = git(source, 'log', '--format=%H', '--', path).splitlines()
        result['configuration_evidence'].append({'source_path': path, 'sha256': digest(content), 'git_blob': git(source, 'rev-parse', COMMIT + ':' + path), 'history_commits': history})
    notebook = json.loads((source / 'colab.ipynb').read_bytes())
    needles = ['https://zenodo.org/records/14827784/files/Dataset.zip', 'images.setdefault', 'labels.setdefault', 'labels.get', 'shutil.copy2(lbl', "dst_lbl.write_text('')", "'names': {0: 'd', 1: 'D'}", "data='yolo_split/data.yaml'", 'imgsz=1280', 'batch=32']
    result['notebook_operations'] = []
    for cell_index, cell in enumerate(notebook['cells'], 1):
        if cell.get('cell_type') != 'code':
            continue
        for line_index, line in enumerate(''.join(cell.get('source', [])).splitlines(), 1):
            if any(needle in line for needle in needles):
                result['notebook_operations'].append({'cell_number_1based': cell_index, 'line_number_in_cell_1based': line_index, 'source_line': line.strip()})
    result['repository_commit_history'] = [{'sha': fields[0], 'subject': fields[1]} for line in git(source, 'log', '--format=%H%x09%s').splitlines() if len(fields := line.split('\t', 1)) == 2]
    if args.checkpoint:
        from inspect_checkpoint import inspect
        result['checkpoint_metadata'] = inspect(args.checkpoint, CHECKPOINT_SHA256)
    args.output.write_text(json.dumps(result, indent=2) + '\n')


if __name__ == '__main__':
    main()
