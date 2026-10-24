FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /service
COPY requirements.txt requirements-onnx.txt constraints.lock.txt ./
RUN pip install --no-cache-dir -c constraints.lock.txt -r requirements-onnx.txt && useradd --uid 10001 --create-home sonri
COPY sonri_inference ./sonri_inference
USER 10001
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/healthz', timeout=2)"
CMD ["uvicorn", "sonri_inference.api:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log", "--workers", "1"]
