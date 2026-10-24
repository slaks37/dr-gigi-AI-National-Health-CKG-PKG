"""Only operator-pinned, local, integrity-checked artifacts may execute."""
import hashlib
import importlib.util
import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path

from .config import Settings


@dataclass
class ModelSpec:
    id: str
    modality: str
    adapter: str
    version: str = "unconfigured"
    architecture: str = ""
    source: str = ""
    license: str = "UNKNOWN"
    unavailable_reason: str = "CHECKPOINT_NOT_CONFIGURED"
    checkpoint: str | None = None
    sha256: str | None = None
    enabled: bool = False
    license_acknowledged: bool = False
    trusted_checkpoint: bool = False
    class_names: dict[str, str] = field(default_factory=dict)
    class_mapping_verified: bool = False
    input_size: int = 640
    output_format: str = ""
    # No manifest can override the service's clinical/research boundary.


DEFAULTS = [
    ModelSpec("intraoral-yolo", "intraoral", "yolo", architecture="YOLO11m", source="slaks37/dental_study", license="AGPL-3.0; commercial obligations require review"),
    ModelSpec("oral-classifier", "intraoral", "onnx-classifier", architecture="Oral disease classifier", source="slaks37/Oral-Disease-detector-sonri", unavailable_reason="VERIFIED_CLASSIFIER_EXPORT_AND_LABEL_METADATA_REQUIRED"),
    ModelSpec("panoramic-dentex", "panoramic", "onnx-detector", architecture="DENTEX-compatible detector", source="slaks37/DENTEXsonri", unavailable_reason="DENTEX_CHECKPOINT_AND_FDI_CLASS_MAPPING_REQUIRED"),
    ModelSpec("panoramic-bone-loss", "panoramic", "onnx-segmenter", architecture="YOLOv8 / U-Net", source="slaks37/YOLOv8_Unet_panoramic_dental_segmentation_and_bone_loss_quantification-sonri", unavailable_reason="COMPATIBLE_SEGMENTATION_WEIGHTS_AND_CALIBRATION_REQUIRED"),
    ModelSpec("cbct-toothseg", "cbct", "toothseg", architecture="nnU-Net ToothSeg", source="slaks37/ToothSeg-sonri", unavailable_reason="VERIFIED_NNUNET_BUNDLE_AND_CBCT_VOLUME_REQUIRED"),
    ModelSpec("comparative-rfdetr", "intraoral", "onnx-detector", architecture="RF-DETR", source="slaks37/rf-detr", unavailable_reason="VERIFIED_ONNX_EXPORT_AND_PREPROCESSING_CONTRACT_REQUIRED"),
    ModelSpec("comparative-maskrcnn", "intraoral", "onnx-detector", architecture="Mask R-CNN", source="slaks37/Tooth-and-Cavity-Instance-Segmentation", unavailable_reason="VERIFIED_COMPATIBLE_WEIGHTS_AND_LICENSE_REQUIRED"),
]
DEPENDENCIES = {"yolo": "ultralytics", "onnx-classifier": "onnxruntime", "onnx-detector": "onnxruntime", "onnx-segmenter": "onnxruntime", "toothseg": "nnunetv2"}
FORMATS = {"yolo": {"ultralytics"}, "onnx-classifier": {"nchw-logits"}, "onnx-detector": {"normalized-xyxy-scores-labels", "rfdetr-cxcywh-logits"}, "onnx-segmenter": {"nchw-logits"}, "toothseg": {"nnunetv2-bundle"}}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


class Registry:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.models = {model.id: ModelSpec(**asdict(model)) for model in DEFAULTS}
        if settings.registry_path:
            raw = json.loads(settings.registry_path.read_text())
            if not isinstance(raw, dict) or raw.get("schema_version") != "1" or not isinstance(raw.get("models"), list):
                raise ValueError("Invalid model registry schema")
            for override in raw["models"]:
                if not isinstance(override, dict):
                    raise ValueError("Invalid model registry entry")
                model_id = override.get("id")
                if model_id not in self.models:
                    raise ValueError("Unknown model id in registry")
                original = self.models[model_id]
                if override.get("modality", original.modality) != original.modality or override.get("adapter", original.adapter) != original.adapter:
                    raise ValueError("Registry cannot change a model modality or adapter")
                self.models[model_id] = ModelSpec(**(asdict(original) | override))
        self._verified = {}

    def availability(self, spec: ModelSpec) -> tuple[bool, str | None]:
        if spec.enabled is not True:
            return False, spec.unavailable_reason
        if spec.license_acknowledged is not True or not isinstance(spec.license, str) or spec.license == "UNKNOWN":
            return False, "LICENSE_REVIEW_REQUIRED"
        if spec.trusted_checkpoint is not True:
            return False, "TRUSTED_CHECKPOINT_ACKNOWLEDGMENT_REQUIRED"
        if not spec.checkpoint or not spec.sha256 or not re.fullmatch(r"[a-f0-9]{64}", spec.sha256):
            return False, "LOCAL_CHECKPOINT_AND_SHA256_REQUIRED"
        if not self.settings.model_root:
            return False, "MODEL_ROOT_REQUIRED"
        checkpoint = Path(spec.checkpoint).resolve()
        if not checkpoint.is_relative_to(self.settings.model_root.resolve()):
            return False, "CHECKPOINT_OUTSIDE_MODEL_ROOT"
        if spec.adapter == "toothseg":
            # A deployable bundle must be pinned as a tar-free directory with a
            # sha256 manifest covering every model file; support is fail closed
            # until its exact task/plans contract has been independently verified.
            return False, "TOOTHSEG_BUNDLE_CONTRACT_NOT_VERIFIED"
        if not checkpoint.is_file():
            return False, "CHECKPOINT_MISSING"
        if checkpoint.stat().st_size > 2 * 1024**3:
            return False, "CHECKPOINT_TOO_LARGE"
        signature = (str(checkpoint), checkpoint.stat().st_mtime_ns, checkpoint.stat().st_size, spec.sha256)
        if signature not in self._verified:
            if sha256_file(checkpoint) != spec.sha256:
                return False, "CHECKPOINT_SHA256_MISMATCH"
            self._verified[signature] = True
        dependency = DEPENDENCIES.get(spec.adapter)
        if not dependency or importlib.util.find_spec(dependency) is None:
            return False, "OPTIONAL_RUNTIME_NOT_INSTALLED"
        if spec.output_format not in FORMATS.get(spec.adapter, set()):
            return False, "MODEL_IO_CONTRACT_NOT_VERIFIED"
        if spec.output_format == "rfdetr-cxcywh-logits" and spec.id != "comparative-rfdetr":
            return False, "MODEL_IO_CONTRACT_NOT_VERIFIED"
        if type(spec.input_size) is not int or not 32 <= spec.input_size <= 2048:
            return False, "INVALID_INPUT_SIZE"
        return True, None

    def public(self, spec: ModelSpec) -> dict:
        available, reason = self.availability(spec)
        return {"id": spec.id, "version": spec.version, "modality": spec.modality,
                "adapter": spec.adapter, "architecture": spec.architecture,
                "source": spec.source, "license": spec.license,
                "available": available, "reason": reason,
                "sha256": spec.sha256, "label_verification": "UNVERIFIED",
                "availability_basis": "ARTIFACT_DIGEST_AND_RUNTIME_DEPENDENCY_PRESENCE",
                "clinical_use": "PROHIBITED", "research_only": True,
                "fdi_numbering_available": False,
                "limitations": ["No independent clinical validation", "Model scores are not disease probabilities", "A negative result does not establish health"]}
