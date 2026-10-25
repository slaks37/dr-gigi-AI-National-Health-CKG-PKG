"""Run the pinned trusted YOLO on an authorized local cohort; no training."""
import argparse
import hashlib
import json
import os
import platform
import tempfile
import time
from pathlib import Path
from importlib.metadata import version

from evaluate import audit_manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--checkpoint', type=Path, required=True)
    parser.add_argument('--sha256', required=True)
    parser.add_argument('--purpose', choices=['source-reproduction', 'independent-benchmark'], required=True)
    parser.add_argument('--acknowledge-research-checkpoint-license', action='store_true', required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.sha256 != '7d5f7dcf616f1febbbb28f2552f9d8a2c3e31e90b3c5b03bf26114502dea621d' or hashlib.file_digest(args.checkpoint.open('rb'), 'sha256').hexdigest() != args.sha256:
        raise ValueError('KNOWN_CHECKPOINT_SHA256_REQUIRED')
    manifest = json.loads(args.manifest.read_text())
    audit = audit_manifest(manifest, args.sha256, args.purpose)
    if manifest['provenance']['modality'] != 'intraoral-occlusal':
        raise ValueError('MODALITY_MISMATCH')
    with tempfile.TemporaryDirectory(prefix='sonri-evaluation-config-') as config:
        os.environ['YOLO_CONFIG_DIR'] = config
        os.environ['YOLO_OFFLINE'] = 'true'
        from ultralytics import YOLO
        from PIL import Image
        model = YOLO(str(args.checkpoint.resolve()), task='detect')
        if model.names != {0: 'd', 1: 'D'}:
            raise ValueError('CHECKPOINT_NAMES_CHANGED')
        result = {}
        timings = []
        for index, image in enumerate(manifest['images']):
            path = Path(image['path'])
            if hashlib.file_digest(path.open('rb'), 'sha256').hexdigest() != image['sha256']:
                raise ValueError('FROZEN_IMAGE_HASH_MISMATCH')
            with Image.open(path) as original:
                if original.size != (image['width'], image['height']):
                    raise ValueError('ANNOTATION_IMAGE_DIMENSION_MISMATCH')
                rgb = original.convert('RGB')
                start = time.perf_counter()
                p = model.predict(rgb, imgsz=1280, device='cpu', conf=.001, iou=.7, max_det=300, verbose=False)[0]
                timings.append(time.perf_counter() - start)
            result[image['sha256']] = [{'class_id': int(cid), 'score': float(score), 'box': [float(v) for v in box]} for cid, score, box in zip(p.boxes.cls.cpu().tolist(), p.boxes.conf.cpu().tolist(), p.boxes.xyxyn.cpu().tolist())]
            print(f'evaluated source record {index + 1}/{len(manifest["images"])}', flush=True)
        args.output.write_text(json.dumps(result, indent=2) + '\n')
        runtime = {'python': platform.python_version(), 'platform': platform.platform(), 'ultralytics': version('ultralytics'), 'torch': version('torch'), 'device': 'cpu', 'imgsz': 1280, 'nms_iou': .7, 'prediction_min_confidence': .001, 'max_det_per_image': 300, 'latency_seconds_per_image': timings, 'total_inference_seconds': sum(timings), 'clinical_use': 'PROHIBITED', 'audit': audit}
        args.output.with_suffix('.runtime.json').write_text(json.dumps(runtime, indent=2) + '\n')


if __name__ == '__main__':
    main()
