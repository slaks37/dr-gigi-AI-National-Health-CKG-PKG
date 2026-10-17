"""Offline research inference. No patient endpoint imports this module."""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import signal
import socket
import sys
import time

ARCHITECTURES = ('RFDETRNano', 'RFDETRSmall', 'RFDETRMedium', 'RFDETRLarge')


def sha256(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def validate_manifest(manifest):
    if manifest.get('architecture') not in ARCHITECTURES:
        raise ValueError('Unsupported architecture')
    if manifest.get('license') != 'Apache-2.0' or not manifest.get('artifact_use_approved'):
        raise ValueError('Artifact permissions missing')
    if not manifest.get('image_use_approved') or manifest.get('input_modality') != 'INTRAORAL_PHOTO':
        raise ValueError('Image use approval or modality missing')
    if not manifest.get('model_id') or not manifest.get('model_version'):
        raise ValueError('Model provenance missing')
    labels = manifest.get('class_labels', {})
    if not labels or any(not k.isdigit() or not isinstance(v, str) or not v for k, v in labels.items()):
        raise ValueError('Verified raw class labels required')
    threshold = manifest.get('threshold', 0.25)
    if not isinstance(threshold, (int, float)) or not math.isfinite(threshold) or not 0 <= threshold <= 1:
        raise ValueError('Invalid threshold')
    return manifest


def normalized_box(xyxy, width, height):
    box = [float(xyxy[0]) / width * 1000, float(xyxy[1]) / height * 1000,
           float(xyxy[2]) / width * 1000, float(xyxy[3]) / height * 1000]
    if any(not math.isfinite(v) or v < 0 or v > 1000 for v in box) or box[0] >= box[2] or box[1] >= box[3]:
        raise ValueError('Invalid model box')
    return dict(zip(('xmin', 'ymin', 'xmax', 'ymax'), box))


def run(manifest_path, artifact, image_path):
    m = validate_manifest(json.loads(Path(manifest_path).read_text()))
    if not Path(artifact).is_file() or sha256(artifact) != m['artifact_sha256']:
        raise ValueError('Missing artifact or checksum mismatch')
    if Path(image_path).stat().st_size > 12_000_000:
        raise ValueError('Image byte limit exceeded')
    # Libraries cannot download checkpoints/backbones or transmit images in this runner.
    def reject_network(*args, **kwargs):
        raise RuntimeError('Offline runner: network unavailable')
    socket.socket.connect = reject_network
    socket.create_connection = reject_network
    os.environ['HF_HUB_OFFLINE'] = '1'
    os.environ['TRANSFORMERS_OFFLINE'] = '1'
    import torch
    import rfdetr
    from PIL import Image, ImageOps
    torch.set_num_threads(2)
    Image.MAX_IMAGE_PIXELS = 16_000_000
    with Image.open(image_path) as source:
        if source.format not in ('JPEG', 'PNG', 'WEBP') or source.width * source.height > 16_000_000:
            raise ValueError('Unsupported image or pixel limit exceeded')
        image = ImageOps.exif_transpose(source).convert('RGB')
    started = time.perf_counter()
    model = getattr(rfdetr, m['architecture'])(pretrain_weights=str(Path(artifact).resolve()), device='cpu')
    detections = model.predict(image, threshold=m.get('threshold', 0.25))
    if len(detections) > 200:
        raise ValueError('Detection resource limit exceeded')
    results = []
    for box, score, class_id in zip(detections.xyxy, detections.confidence, detections.class_id):
        label = m['class_labels'].get(str(int(class_id)))
        if label is None or not math.isfinite(float(score)) or not 0 <= float(score) <= 1:
            raise ValueError('Unexpected class or invalid score')
        results.append(dict(class_id=int(class_id), raw_label=label, score=float(score),
                            box=normalized_box(box, image.width, image.height)))
    return dict(model_id=m['model_id'], model_version=m['model_version'],
                artifact_sha256=m['artifact_sha256'], input_modality='INTRAORAL_PHOTO',
                prediction_type='BOUNDING_BOX', image_sha256=sha256(image_path),
                processing_ms=(time.perf_counter() - started) * 1000,
                inference_status='SUCCEEDED', readiness='EXPERIMENTAL', detections=results)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--manifest', required=True)
    parser.add_argument('--artifact', required=True)
    parser.add_argument('--image', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--timeout', type=int, default=120, choices=range(1, 301))
    args = parser.parse_args()
    def timeout(*_):
        raise TimeoutError('Inference deadline exceeded')
    signal.signal(signal.SIGALRM, timeout)
    signal.alarm(args.timeout)
    try:
        result = run(args.manifest, args.artifact, args.image)
        # Exclusive create: do not overwrite an earlier prediction or artifact.
        fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w') as output:
            json.dump(result, output, indent=2)
        print(json.dumps(dict(inference_status='SUCCEEDED', detections=len(result['detections']))))
    except Exception as error:
        # Paths, raw images and model internals are not ordinary log output.
        print(json.dumps(dict(inference_status='FAILED', error_type=type(error).__name__)), file=sys.stderr)
        sys.exit(1)
    finally:
        signal.alarm(0)


if __name__ == '__main__':
    main()
