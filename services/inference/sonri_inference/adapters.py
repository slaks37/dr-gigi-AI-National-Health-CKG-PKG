"""Backend-specific raw outputs. No raw output becomes a diagnosis here."""
import math
import os
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

from .registry import ModelSpec


class InvalidModelOutput(ValueError):
    pass


def score(value):
    result = float(value)
    if not math.isfinite(result) or not 0 <= result <= 1:
        raise InvalidModelOutput("INVALID_MODEL_SCORE")
    return round(result, 7)


def label(spec, class_id, native_names=None):
    names = native_names or spec.class_names
    return str(names.get(class_id, names.get(str(class_id), str(class_id))))[:160]


def box(coords):
    result = [float(value) for value in coords]
    if len(result) != 4 or not all(math.isfinite(value) and 0 <= value <= 1 for value in result):
        raise InvalidModelOutput("INVALID_MODEL_BOX")
    if result[0] >= result[2] or result[1] >= result[3]:
        raise InvalidModelOutput("INVALID_MODEL_BOX")
    return [round(value, 6) for value in result]


class YoloAdapter:
    def __init__(self, spec: ModelSpec):
        # torch checkpoints are executable pickle: the Registry requires a known
        # digest AND an explicit operator trust acknowledgment before this import.
        os.environ["YOLO_OFFLINE"] = "true"
        self._config_directory = tempfile.TemporaryDirectory(prefix="sonri-yolo-config-")
        os.environ["YOLO_CONFIG_DIR"] = self._config_directory.name
        from ultralytics import YOLO
        self.spec = spec
        self.model = YOLO(str(Path(spec.checkpoint).resolve()), task="detect")

    def infer(self, image: Image.Image):
        prediction = self.model.predict(image, imgsz=self.spec.input_size, device="cpu", conf=0.25, max_det=100, verbose=False)[0]
        findings = []
        if prediction.boxes is not None:
            for coords, confidence, class_id in zip(prediction.boxes.xyxyn.cpu().tolist(), prediction.boxes.conf.cpu().tolist(), prediction.boxes.cls.cpu().tolist()):
                cid = int(class_id)
                findings.append({"kind": "detection", "raw_label": label(self.spec, cid, prediction.names),
                                 "class_id": cid, "score": score(confidence), "box": box(coords),
                                 "label_verification": "UNVERIFIED", "review_status": "UNCONFIRMED"})
        return findings


class OnnxAdapter:
    def __init__(self, spec: ModelSpec):
        import onnxruntime as ort
        self.spec = spec
        options = ort.SessionOptions()
        options.intra_op_num_threads = 2
        self.session = ort.InferenceSession(str(Path(spec.checkpoint).resolve()), sess_options=options, providers=["CPUExecutionProvider"])
        if len(self.session.get_inputs()) != 1:
            raise InvalidModelOutput("ONNX_SINGLE_IMAGE_INPUT_REQUIRED")
        source = self.session.get_inputs()[0]
        if source.type != "tensor(float)" or len(source.shape) != 4:
            raise InvalidModelOutput("ONNX_FLOAT_NCHW_REQUIRED")
        self.input_name = source.name
        expected = [1, 3, spec.input_size, spec.input_size]
        if any(isinstance(got, int) and got != wanted for got, wanted in zip(source.shape, expected)):
            raise InvalidModelOutput("ONNX_INPUT_SHAPE_MISMATCH")

    def infer(self, image: Image.Image):
        # Contract: square RGB bilinear resize; float32 NCHW in [0,1].
        tensor = np.asarray(image.resize((self.spec.input_size, self.spec.input_size), Image.Resampling.BILINEAR), dtype=np.float32).transpose(2, 0, 1)[None] / 255.0
        if self.spec.output_format == "rfdetr-cxcywh-logits":
            # RF-DETR upstream tensor Resize uses bilinear half-pixel centers,
            # without PIL's downsampling antialias. Preserve float pixels.
            side = self.spec.input_size
            rgb = np.asarray(image, dtype=np.float32)
            y = np.maximum(0, (np.arange(side, dtype=np.float32) + 0.5) * image.height / side - 0.5)
            x = np.maximum(0, (np.arange(side, dtype=np.float32) + 0.5) * image.width / side - 0.5)
            y0, x0 = y.astype(np.int32), x.astype(np.int32)
            y1, x1 = np.minimum(y0 + 1, image.height - 1), np.minimum(x0 + 1, image.width - 1)
            fy, fx = (y - y0)[:, None, None], (x - x0)[None, :, None]
            resized = ((rgb[y0[:, None], x0[None, :]] * (1 - fx) + rgb[y0[:, None], x1[None, :]] * fx) * (1 - fy)
                       + (rgb[y1[:, None], x0[None, :]] * (1 - fx) + rgb[y1[:, None], x1[None, :]] * fx) * fy)
            tensor = ((resized / 255.0 - np.array([.485, .456, .406], dtype=np.float32)) / np.array([.229, .224, .225], dtype=np.float32)).transpose(2, 0, 1)[None].astype(np.float32)
        outputs = self.session.run(None, {self.input_name: tensor})
        if any(not np.isfinite(output).all() for output in outputs):
            raise InvalidModelOutput("NONFINITE_MODEL_OUTPUT")
        if self.spec.output_format == "rfdetr-cxcywh-logits":
            output_map = dict(zip([item.name for item in self.session.get_outputs()], outputs))
            if set(output_map) != {"dets", "labels"} or output_map["dets"].shape != (1, 300, 4) or output_map["labels"].shape != (1, 300, 5):
                raise InvalidModelOutput("RFDETR_OUTPUT_CONTRACT_MISMATCH")
            boxes, logits = output_map["dets"][0], output_map["labels"][0]
            probabilities = 1 / (1 + np.exp(-np.clip(logits.astype(np.float64), -700, 700)))
            pairs = np.argsort(-probabilities.flatten(), kind="stable")[:300]
            pairs = [int(index) for index in pairs if probabilities.flatten()[index] > .25]
            if len(pairs) > 200:
                raise InvalidModelOutput("DETECTION_LIMIT_EXCEEDED")
            findings = []
            for index in pairs:
                query, cid = divmod(index, 5)
                cx, cy, width, height = [float(value) for value in boxes[query]]
                if width <= 0 or height <= 0:
                    raise InvalidModelOutput("INVALID_MODEL_BOX")
                coords = [max(0, cx - width / 2), max(0, cy - height / 2), min(1, cx + width / 2), min(1, cy + height / 2)]
                findings.append({"kind": "detection", "class_id": cid, "raw_label": label(self.spec, cid),
                                 "score": score(probabilities[query, cid]), "box": box(coords), "label_verification": "UNVERIFIED", "review_status": "UNCONFIRMED"})
            return findings
        if self.spec.adapter == "onnx-classifier":
            if len(outputs) != 1 or outputs[0].ndim != 2 or outputs[0].shape[0] != 1:
                raise InvalidModelOutput("CLASSIFIER_OUTPUT_CONTRACT_MISMATCH")
            logits = outputs[0][0].astype(np.float64)
            if not 1 < len(logits) <= 1000:
                raise InvalidModelOutput("CLASSIFIER_OUTPUT_CONTRACT_MISMATCH")
            probabilities = np.exp(logits - logits.max())
            probabilities /= probabilities.sum()
            return [{"kind": "classification", "class_id": int(index), "raw_label": label(self.spec, int(index)),
                     "score": score(probabilities[index]), "label_verification": "UNVERIFIED", "review_status": "UNCONFIRMED"}
                    for index in np.argsort(probabilities)[-5:][::-1]]
        if self.spec.adapter == "onnx-segmenter":
            if len(outputs) != 1 or outputs[0].ndim != 4 or outputs[0].shape[0] != 1 or not 2 <= outputs[0].shape[1] <= 100:
                raise InvalidModelOutput("SEGMENTATION_OUTPUT_CONTRACT_MISMATCH")
            classes = outputs[0][0].argmax(axis=0)
            ids, counts = np.unique(classes, return_counts=True)
            # Raw segmentation areas are NOT bone-loss clinical measurements.
            return [{"kind": "segmentation_area", "class_id": int(cid), "raw_label": label(self.spec, int(cid)),
                     "pixel_fraction": round(float(count / classes.size), 7), "label_verification": "UNVERIFIED", "review_status": "UNCONFIRMED"}
                    for cid, count in zip(ids, counts)]
        # Verified detector export contract uses three named outputs. Never guess
        # RF-DETR logits / YOLO channels / DENTEX FDI semantics from dimensions.
        output_map = dict(zip([item.name for item in self.session.get_outputs()], outputs))
        if set(output_map) != {"boxes", "scores", "labels"}:
            raise InvalidModelOutput("DETECTOR_OUTPUT_CONTRACT_MISMATCH")
        boxes, scores, labels = (output_map[key] for key in ("boxes", "scores", "labels"))
        if boxes.ndim != 2 or boxes.shape[1] != 4 or scores.ndim != 1 or labels.ndim != 1 or not len(boxes) == len(scores) == len(labels) or len(boxes) > 10000:
            raise InvalidModelOutput("DETECTOR_OUTPUT_CONTRACT_MISMATCH")
        findings = []
        for coords, confidence, class_id in sorted(zip(boxes, scores, labels), key=lambda item: float(item[1]), reverse=True)[:100]:
            if float(confidence) < 0.25:
                continue
            cid = int(class_id)
            if cid != float(class_id) or cid < 0:
                raise InvalidModelOutput("INVALID_MODEL_CLASS")
            findings.append({"kind": "detection", "class_id": cid, "raw_label": label(self.spec, cid),
                             "score": score(confidence), "box": box(coords), "label_verification": "UNVERIFIED", "review_status": "UNCONFIRMED"})
        return findings


def create_adapter(spec: ModelSpec):
    if spec.adapter == "yolo":
        return YoloAdapter(spec)
    if spec.adapter in {"onnx-classifier", "onnx-detector", "onnx-segmenter"}:
        return OnnxAdapter(spec)
    raise InvalidModelOutput("UNSUPPORTED_MODEL_RUNTIME")
