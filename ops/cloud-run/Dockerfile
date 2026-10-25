# Build context: services/inference. No checkpoint, dataset or credential is copied.
FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=8080 \
    SONRI_MODEL_REGISTRY=/config/registry.json SONRI_MODEL_ROOT=/models \
    OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1
WORKDIR /service
COPY requirements.txt requirements-onnx.txt requirements-yolo.txt constraints.lock.txt ./
RUN useradd --uid 10001 --create-home sonri && mkdir /models /config
COPY sonri_inference ./sonri_inference
COPY registry.example.json /config/registry.json
COPY cloud_run_entrypoint.py ./cloud_run_entrypoint.py
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:'+os.getenv('PORT','8080')+'/healthz',timeout=2)"
CMD ["python", "cloud_run_entrypoint.py"]

# Optional research profile. Review Ultralytics/model/data rights before use.
# CPU wheels avoid downloading CUDA dependencies or requesting GPU resources.
FROM base AS yolo-cpu
RUN apt-get update && apt-get install -y --no-install-recommends libglib2.0-0 libgl1 && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch==2.8.0 torchvision==0.23.0 && \
    pip install --no-cache-dir -c constraints.lock.txt -r requirements-onnx.txt -r requirements-yolo.txt
USER 10001

# Keep the final/default build lean; YOLO requires an explicit --target yolo-cpu.
FROM base AS onnx-cpu
RUN pip install --no-cache-dir -c constraints.lock.txt -r requirements-onnx.txt
USER 10001
