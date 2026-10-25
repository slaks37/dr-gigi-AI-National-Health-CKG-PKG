import io
import warnings

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError


class InvalidImage(ValueError):
    pass


def decode_image(data: bytes, content_type: str, modality: str, max_pixels: int):
    if content_type not in {"image/png", "image/jpeg"}:
        raise InvalidImage("PNG_OR_JPEG_REQUIRED")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as source:
                if source.format not in {"PNG", "JPEG"}:
                    raise InvalidImage("UNSUPPORTED_IMAGE_FORMAT")
                if source.format != {"image/png": "PNG", "image/jpeg": "JPEG"}[content_type]:
                    raise InvalidImage("MIME_CONTENT_MISMATCH")
                if source.width * source.height > max_pixels:
                    raise InvalidImage("IMAGE_PIXEL_LIMIT_EXCEEDED")
                if getattr(source, "n_frames", 1) != 1:
                    raise InvalidImage("ANIMATED_IMAGE_UNSUPPORTED")
                source.load()
                image = ImageOps.exif_transpose(source).convert("RGB")
                # Never return/save EXIF (which can contain GPS and identifiers).
                image.info.clear()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        raise InvalidImage("IMAGE_DECODE_FAILED") from error
    width, height = image.size
    gray = np.asarray(image.resize((256, 256)).convert("L"), dtype=np.float32)
    mean = float(gray.mean())
    laplacian = -4 * gray[1:-1, 1:-1] + gray[:-2, 1:-1] + gray[2:, 1:-1] + gray[1:-1, :-2] + gray[1:-1, 2:]
    blur_score = float(laplacian.var())
    reasons = []
    if min(width, height) < 128:
        reasons.append("RESOLUTION_TOO_LOW")
    if mean < 15 or mean > 245:
        reasons.append("EXPOSURE_UNSUITABLE")
    if blur_score < 5:
        reasons.append("LOW_DETAIL_OR_BLUR")
    aspect = width / height
    if modality == "panoramic" and not 1.4 <= aspect <= 4.5:
        reasons.append("PANORAMIC_ASPECT_INCOMPATIBLE")
    quality = {"accepted": not reasons, "width": width, "height": height,
               "mean_brightness": round(mean, 3), "laplacian_variance": round(blur_score, 3),
               "reasons": reasons, "compatibility": "MODALITY_SELF_REPORTED",
               "limitations": ["Quality checks do not prove an oral image or correct modality", "Thresholds are technical heuristics, not clinically validated"]}
    return image, quality
