"""Read known PyTorch ZIP pickle metadata with inert stand-ins, without torch.load.

Every pickle GLOBAL resolves to a local inert object, never the named callable;
no tensor storage is reconstructed. This is an evidence extractor, not a runtime
checkpoint loader. Supply and verify the expected digest before parsing.
"""
import argparse
import hashlib
import io
import json
import pickle
import zipfile
from pathlib import Path


class Inert:
    def __init__(self, *args, **kwargs):
        self._arguments = args
    def __setstate__(self, state):
        if isinstance(state, dict):
            self.__dict__.update(state)
        elif isinstance(state, tuple):
            for part in state:
                if isinstance(part, dict):
                    self.__dict__.update(part)
    def __setitem__(self, key, value):
        self.__dict__.setdefault('_items', {})[key] = value


class MetadataUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        # Do not import, invoke, or return any checkpoint-named global.
        return Inert
    def persistent_load(self, pid):
        return Inert()


def inspect(path, expected_digest):
    digest = hashlib.file_digest(path.open('rb'), 'sha256').hexdigest()
    if digest != expected_digest:
        raise ValueError('CHECKPOINT_SHA256_MISMATCH')
    with zipfile.ZipFile(path) as archive:
        names = [item for item in archive.infolist() if item.filename.endswith('/data.pkl')]
        if len(names) != 1 or names[0].file_size > 8_000_000:
            raise ValueError('UNSUPPORTED_CHECKPOINT_PICKLE')
        metadata = MetadataUnpickler(io.BytesIO(archive.read(names[0]))).load()
    result = {'schema_version': 'sonri.checkpoint-metadata.v1', 'checkpoint_sha256': digest, 'inspection_method': 'digest-verified ZIP, pickle globals replaced by inert local stand-ins; no tensor deserialization or checkpoint code execution', 'top_level_keys': list(metadata), 'raw_class_names': None, 'training': {}, 'class_name_metadata': {}}
    for key in ['ema', 'model']:
        value = metadata.get(key)
        if isinstance(value, Inert) and isinstance(getattr(value, 'names', None), dict):
            result['raw_class_names'] = {str(k): v for k, v in value.names.items()}
    args = metadata.get('train_args', metadata.get('args', {}))
    args = vars(args) if isinstance(args, Inert) else args
    for key in ['data', 'model', 'imgsz', 'batch', 'epochs', 'dataset_file', 'num_classes', 'class_names', 'input_size', 'resolution']:
        value = args.get(key) if isinstance(args, dict) else None
        if isinstance(value, (str, int, float, list, dict)) or value is None:
            result['training'][key] = value
    for key in ['class_names', 'classes', 'id2label', 'label2id', 'category_id_to_class_id', 'background_class_id']:
        if key in metadata:
            value = metadata[key]
            if isinstance(value, (str, int, list, dict)) or value is None:
                result['class_name_metadata'][key] = value
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--checkpoint', type=Path, required=True)
    parser.add_argument('--sha256', required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    args.output.write_text(json.dumps(inspect(args.checkpoint, args.sha256), indent=2) + '\n')
