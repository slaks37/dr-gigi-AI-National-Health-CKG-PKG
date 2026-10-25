import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    api_token: str = ""
    registry_path: Path | None = None
    model_root: Path | None = None
    max_upload_bytes: int = 24 * 1024 * 1024
    max_cbct_bytes: int = 100 * 1024 * 1024
    max_pixels: int = 20_000_000
    max_voxels: int = 256_000_000
    inference_timeout: float = 90.0
    max_concurrent: int = 1
    requests_per_minute: int = 20

    @classmethod
    def from_env(cls):
        registry = os.getenv("SONRI_MODEL_REGISTRY")
        root = os.getenv("SONRI_MODEL_ROOT")
        return cls(api_token=os.getenv("INFERENCE_API_TOKEN", ""),
                   registry_path=Path(registry) if registry else None,
                   model_root=Path(root) if root else None)
