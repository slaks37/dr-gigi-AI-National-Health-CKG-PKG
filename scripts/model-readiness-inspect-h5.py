#!/usr/bin/env python3
"""Inspect the authorized oral-classifier checkpoint as HDF5 data, never as code.

Install h5py==3.15.1 into a separate private venv. The expected SHA-256 is a
local observation of Kaggle Keras/default v1, not a publisher attestation.
No TensorFlow import, model deserialization, network call or inference occurs.
"""
import argparse
import collections
import hashlib
import json
from pathlib import Path
import sys


OBSERVED_SHA256 = "4d4735b624affe6c6fda4b9033eee02bd728b4b188b59e6c5ceb200ebb1073c3"
MAX_BYTES = 100_000_000


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def summarize_config(config):
    counts = collections.Counter()
    function_nodes = []
    lambda_layers = []

    def walk(node, path="model"):
        if isinstance(node, dict):
            kind = node.get("class_name")
            if isinstance(kind, str):
                counts[kind] += 1
            if kind in {"Lambda", "TFOpLambda", "SlicingOpLambda"}:
                function = node.get("config", {}).get("function", {})
                function = function if isinstance(function, dict) else {}
                lambda_layers.append({
                    "path": path, "layer_name": node.get("config", {}).get("name"),
                    "function_kind": function.get("class_name"),
                    "function_name": function.get("config") if isinstance(function.get("config"), str)
                    and len(function["config"]) < 120 else "SERIALIZED_CONTENT_NOT_EMITTED",
                    "requires_explicit_runtime_review": True,
                })
            if kind in {"function", "__lambda__", "Function"}:
                function_nodes.append({"path": path, "kind": kind,
                                       "inline_bytecode": kind == "__lambda__"})
            for key, value in node.items():
                walk(value, path + "." + key)
        elif isinstance(node, list):
            for index, value in enumerate(node):
                walk(value, f"{path}[{index}]")

    walk(config)
    outer = config.get("config", {}).get("layers", [])
    inputs = [{"name": layer["config"].get("name"),
               "batch_shape": layer["config"].get("batch_shape"),
               "dtype": layer["config"].get("dtype")}
              for layer in outer if layer.get("class_name") == "InputLayer"]
    dense = [{"name": layer["config"].get("name"),
              "units": layer["config"].get("units"),
              "activation": layer["config"].get("activation")}
             for layer in outer if layer.get("class_name") == "Dense"]
    rescaling = [{"name": layer["config"].get("name"),
                  "scale": layer["config"].get("scale"),
                  "offset": layer["config"].get("offset")}
                 for layer in outer if layer.get("class_name") == "Rescaling"]
    return {"model_class": config.get("class_name"), "serialized_class_counts": dict(counts),
            "outer_layer_count": len(outer), "input_layers": inputs,
            "dense_layers": dense, "rescaling_layers": rescaling,
            "lambda_layers": lambda_layers, "serialized_function_nodes": function_nodes,
            "output_layer_reference": config.get("config", {}).get("output_layers")}


def inspect(path, expected_sha256):
    if path.is_symlink() or not path.is_file() or path.stat().st_size > MAX_BYTES:
        raise ValueError("Expected a regular checkpoint below 100 MB")
    observed = sha256(path)
    if observed != expected_sha256:
        raise ValueError("Checkpoint SHA-256 differs from the reviewed artifact")
    import h5py  # Data parser only; no executable model loader is imported.
    with h5py.File(path, "r") as handle:
        raw = handle.attrs.get("model_config")
        if not isinstance(raw, (str, bytes)) or len(raw) > 5_000_000:
            raise ValueError("Missing or oversized model configuration")
        config = json.loads(raw)
        report = summarize_config(config)
        report.update({"hdf5_attribute_names": sorted(handle.attrs.keys()),
                       "serialized_keras_version": str(handle.attrs.get("keras_version")),
                       "serialized_backend": str(handle.attrs.get("backend"))})
    report.update({"schema_version": "sonri.hdf5-contract-inspection.v1",
                   "artifact_name": path.name, "artifact_bytes": path.stat().st_size,
                   "sha256_observed": observed, "publisher_sha256": None,
                   "method": "HDF5 attributes parsed as JSON; no model code deserialization",
                   "clinical_use_prohibited": True, "runtime_execution": "NOT_RUN",
                   "whole_model_deserialization_permitted": False,
                   "class_order_binding": "UNVERIFIED_NO_ARTIFACT_CLASS_METADATA"})
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("checkpoint", type=Path)
    parser.add_argument("--expected-sha256", default=OBSERVED_SHA256)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    try:
        report = inspect(args.checkpoint, args.expected_sha256)
        output = json.dumps(report, indent=2) + "\n"
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(output)
        print(output, end="")
        return 0
    except (OSError, ValueError, ImportError) as error:
        print(json.dumps({"error": type(error).__name__, "message": str(error)}))
        return 2


if __name__ == "__main__":
    sys.exit(main())
