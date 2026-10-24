#!/usr/bin/env python3
"""Read-only source/provenance audit. Fetches metadata/text only; never datasets or weights.

Requires authenticated gh CLI. Existing raw evidence is intentionally retained by default.
Run: python3 scripts/audit-repositories.py --output /tmp/sonri-repository-audit
"""
import argparse
import base64
import concurrent.futures
import json
from pathlib import Path
import re
import subprocess

REPOSITORIES = [
    'dr-gigi-AI-National-Health-CKG-PKG', 'Sonri-untuk-Negeri', '2.0-Sonry-Oral', 'rf-detr',
    'Tooth-and-Cavity-Instance-Segmentation', 'dental_study', 'ToothSeg-sonri',
    'YOLOv8_Unet_panoramic_dental_segmentation_and_bone_loss_quantification-sonri',
    'DENTEXsonri', 'Oral-Disease-detector-sonri',
]
TEXT_SUFFIXES = {'.md', '.txt', '.py', '.toml', '.yaml', '.yml', '.json', '.rst', '.cfg'}
EVIDENCE_PATHS = {
    'Sonri-untuk-Negeri': ['package.json', 'app/checkup/page.tsx', 'app/lib/db.ts', 'firestore.rules'],
    '2.0-Sonry-Oral': ['package.json', 'services/geminiService.ts', 'services/apiService.ts', 'api/index.ts', 'server.ts', 'types.ts'],
    'Oral-Disease-detector-sonri': ['class_names.json'],
    'Tooth-and-Cavity-Instance-Segmentation': ['src/mask_rcnn_model.py', 'src/mask_rcnn_utils.py', 'src/metric_utils.py'],
    'YOLOv8_Unet_panoramic_dental_segmentation_and_bone_loss_quantification-sonri': ['teeth_det_seg.py', 'TestUnet_batch_seg.py'],
    'dental_study': ['best.pt', 'best_m4.pt', 'yolo11s.pt', 'prepare_data.py', 'train_yolo.py'],
    'ToothSeg-sonri': ['scripts/inference_generel.sh', 'scripts/inference_toothfairy2.sh'],
    'DENTEXsonri': ['HierarchialDet-FinalPhase-Docker/process.py', 'HierarchialDet-FinalPhase-Docker/hierarchialdet/config.py', 'HierarchialDet-FinalPhase-Docker/Dockerfile', 'HierarchialDet-FinalPhase-Docker/configs/diffdet.custom.swinbase.nonpretrain.yaml'],
    'rf-detr': ['LICENSE', 'src/rfdetr/assets/model_weights.py'],
}


def redact_secrets(content):
    # Public source can already contain exposed credentials; never preserve those in audit exports.
    return re.sub(r'(?:sk-|AIza)[A-Za-z0-9_-]{20,}', '[REDACTED_EXPOSED_CREDENTIAL]', content)


def github(endpoint):
    result = subprocess.run(['gh', 'api', endpoint], capture_output=True, text=True, check=False)
    if result.returncode:
        raise RuntimeError(result.stderr.strip())
    return json.loads(result.stdout)


def inspect(name, output):
    directory = output / name
    directory.mkdir(parents=True, exist_ok=True)
    metadata = github(f'repos/slaks37/{name}')
    branch = metadata['default_branch']
    commit = github(f'repos/slaks37/{name}/commits/{branch}')
    sha = commit['sha']
    tree = github(f'repos/slaks37/{name}/git/trees/{sha}?recursive=1')
    releases = github(f'repos/slaks37/{name}/releases?per_page=20')
    relevant = []
    files = [entry for entry in tree['tree'] if entry['type'] == 'blob']
    for entry in files:
        path = entry['path']
        if Path(path).suffix.lower() in {'.pt', '.pth', '.onnx', '.safetensors', '.ckpt', '.bin', '.gguf', '.h5', '.keras'} and entry.get('size', 0) > 512:
            continue  # Only tiny Git LFS pointer metadata is eligible, never checkpoint bytes.
        base = Path(path).name.lower()
        # No medical examples, image contents, datasets, notebooks with image outputs, or binaries.
        if entry.get('size', 0) > 200_000 or (Path(path).suffix.lower() not in TEXT_SUFFIXES and path not in EVIDENCE_PATHS.get(name, [])):
            continue
        score = 0
        if path in EVIDENCE_PATHS.get(name, []):
            score = 120
        elif base.startswith(('readme', 'license', 'copying', 'requirements', 'pyproject', 'setup', 'environment')):
            score = 100
        elif re.search(r'(^|/)(test[^/]*|inference[^/]*|predict[^/]*|model[^/]*|app\.py|config[^/]*|data\.yaml|.*checkpoint.*)$', path, re.I):
            score = 60
        elif re.search(r'(^|/)(\.github/workflows/|docs/)', path):
            score = 20
        if score:
            relevant.append((score - path.count('/'), entry))
    relevant.sort(key=lambda item: (-item[0], item[1]['path']))
    selected = relevant[:30]
    evidence = []
    for _, entry in selected:
        try:
            blob = github(f"repos/slaks37/{name}/git/blobs/{entry['sha']}")
            content = base64.b64decode(blob['content']).decode('utf-8', errors='replace')
            if Path(entry['path']).suffix.lower() in {'.pt', '.pth', '.onnx', '.safetensors', '.ckpt', '.bin', '.gguf', '.h5', '.keras'} and not content.startswith('version https://git-lfs.github.com/spec/v1'):
                raise ValueError('Non-pointer artifact omitted from source audit')
            evidence.append({'path': entry['path'], 'git_blob_sha': entry['sha'], 'source_url': f'https://github.com/slaks37/{name}/blob/{sha}/{entry["path"]}', 'text': redact_secrets(content)})
        except Exception as error:
            evidence.append({'path': entry['path'], 'error': str(error)})
    # Only fields needed for audit; omit account/profile data and credentials.
    record = {
        'repository': metadata['full_name'], 'source_url': metadata['html_url'],
        'default_branch': branch, 'commit': sha, 'commit_date': commit['commit']['committer']['date'],
        'description': metadata.get('description'), 'fork': metadata.get('fork'),
        'upstream': metadata.get('parent', {}).get('full_name'), 'license': metadata.get('license'),
        'tree_truncated': tree.get('truncated'), 'files': files,
        'releases': [{'tag': item['tag_name'], 'url': item['html_url'], 'assets': [{'name': asset['name'], 'url': asset['browser_download_url'], 'size': asset['size'], 'digest': asset.get('digest')} for asset in item['assets']]} for item in releases],
        'evidence': evidence,
    }
    (directory / 'source.json').write_text(json.dumps(record, indent=2) + '\n')
    return {'repository': name, 'commit': sha, 'files': len(files), 'selected_text_files': len(evidence), 'weights': [entry for entry in files if re.search(r'\.(pt|pth|onnx|h5|keras|ckpt|pkl|tflite|bin|safetensors|gguf)$', entry['path'], re.I)]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=Path('/tmp/sonri-repository-audit'))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    failures = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(inspect, name, args.output): name for name in REPOSITORIES}
        for future in concurrent.futures.as_completed(futures):
            try:
                print(json.dumps(future.result()), flush=True)
            except Exception as error:
                failures += 1
                print(json.dumps({'repository': futures[future], 'error': str(error)}), flush=True)
    if failures:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
