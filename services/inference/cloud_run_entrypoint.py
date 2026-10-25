"""Cloud Run container port contract, separate from the existing Compose image."""
import os


def command(environment=None):
    environment = os.environ if environment is None else environment
    raw = environment.get("PORT", "8080")
    if not raw.isascii() or not raw.isdigit() or not 1 <= int(raw) <= 65535:
        raise ValueError("PORT must be an integer from 1 to 65535")
    return ["uvicorn", "sonri_inference.api:app", "--host", "0.0.0.0", "--port", str(int(raw)),
            "--no-access-log", "--workers", "1", "--timeout-keep-alive", "5",
            "--timeout-graceful-shutdown", "10"]


if __name__ == "__main__":
    os.execvp("uvicorn", command())
