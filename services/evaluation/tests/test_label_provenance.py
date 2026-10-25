"""Synthetic fixtures verify audit logic, not dental model performance."""
import json
from pathlib import Path
import sys

import pytest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from trace_label_provenance import compare_annotation_tree, parse_yolo


def source(tmp_path):
    raw = tmp_path / 'Dataset/Annotations/Darknet_YOLO'
    raw.mkdir(parents=True)
    coco = tmp_path / 'Dataset/Annotations/MS_coco'
    coco.mkdir(parents=True)
    for index, split in enumerate(['train', 'val', 'test']):
        labels = tmp_path / 'yolo_split/labels' / split
        labels.mkdir(parents=True)
        name = f'synthetic-patient-{index}'
        content = b'0 0.5 0.5 0.5 0.5\n'
        (labels / (name + '.txt')).write_bytes(content)
        (raw / (name + '.txt')).write_bytes(content)
        (labels / ('unannotated-' + name + '.txt')).write_bytes(b'')
        partition = 'valid' if split == 'val' else split
        # Deliberately varying category IDs; the names define the source class.
        cid = 2 if split == 'test' else 1
        data = {'categories': [{'id': cid, 'name': 'D'}, {'id': 3-cid, 'name': 'd'}], 'images': [{'id': 1, 'file_name': name + '.jpg', 'width': 100, 'height': 100}], 'annotations': [{'image_id': 1, 'category_id': cid, 'bbox': [25, 25, 50, 50]}]}
        (coco / (partition + '.json')).write_text(json.dumps(data))
    return tmp_path


def test_conflicting_source_associations_never_authorize_mapping(tmp_path):
    result = compare_annotation_tree(source(tmp_path))
    assert result['status'] == 'UNVERIFIED_CONTRACT_CONFLICT'
    assert result['class_bindings'] == [] and not result['disease_mapping_authorized']
    for split in ['train', 'val', 'test']:
        stats = result['source_splits'][split]
        assert stats['geometry_associations_iou095'] == {'raw_0->COCO_D': 1}
        assert stats['counts']['byte_identical_original_yolo'] == 1
        assert stats['counts']['empty_label_files'] == 1
        assert stats['counts']['no_original_yolo_stem'] == 1
    assert result['images_read'] == result['model_runs'] == result['training_runs'] == 0
    assert 'synthetic-patient' not in json.dumps(result)


def test_distinct_original_annotations_with_same_stem_are_explicitly_ambiguous(tmp_path):
    tree = source(tmp_path)
    folder = tree / 'Dataset/Annotations/Darknet_YOLO/other'
    folder.mkdir()
    (folder / 'synthetic-patient-0.txt').write_text('1 0.5 0.5 0.5 0.5\n')
    r = compare_annotation_tree(tree)['source_splits']['train']['counts']
    assert r['ambiguous_original_stem_with_distinct_bytes'] == 1
    assert r.get('byte_identical_original_yolo', 0) == 0


@pytest.mark.parametrize('text', [b'0 nan .5 .1 .1', b'2 .5 .5 .1 .1', b'0.5 .5 .5 .1 .1', b'0 .5 .5 .1 .1 extra'])
def test_malformed_annotation_rows_fail_closed(text):
    with pytest.raises(ValueError):
        parse_yolo(text)
