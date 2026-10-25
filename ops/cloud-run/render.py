"""Offline candidate renderer. No subprocess, network, deployment or billing actions."""
import argparse
import json
import re
from pathlib import Path

PROFILES = {"onnx-cpu": {"cpu": "1", "memory": "2Gi"},
            "yolo-cpu": {"cpu": "2", "memory": "4Gi"}}
KEYS = {"project_id", "region", "service", "profile", "image", "worker_service_account",
        "caller_service_account", "token_secret", "token_secret_version", "model_bucket",
        "registry_secret", "registry_secret_version", "model_authorization_reference",
        "license_review_reference", "billing_approval_reference"}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def render(config):
    require(isinstance(config, dict) and not (set(config) - KEYS), "Unknown configuration keys; use secret references, never secret values")
    project = config.get("project_id", "")
    require(re.fullmatch(r"[a-z][a-z0-9-]{4,28}[a-z0-9]", project) is not None, "Invalid isolated project ID")
    region = config.get("region", "")
    require(re.fullmatch(r"[a-z]+-[a-z]+[0-9]", region) is not None, "Invalid region")
    service = config.get("service", "")
    require(re.fullmatch(r"sonri-[a-z0-9-]{1,46}-staging", service) is not None, "Service must be explicitly named sonri-*-staging")
    profile = config.get("profile")
    require(profile in PROFILES, "Unsupported profile; GPU and clinical production are not configured")
    require(profile != "yolo-cpu" or bool(config.get("license_review_reference")), "YOLO profile requires an operator license-review reference")
    image = config.get("image", "")
    require(re.fullmatch(re.escape(region) + r"-docker\.pkg\.dev/" + re.escape(project) + r"/[a-z0-9_./-]+@sha256:[a-f0-9]{64}", image) is not None, "Use a reviewed same-region/project Artifact Registry image digest")
    accounts = {}
    for key in ["worker_service_account", "caller_service_account"]:
        value = config.get(key, "")
        require(re.fullmatch(r"[a-z][a-z0-9-]{4,28}[a-z0-9]@" + re.escape(project) + r"\.iam\.gserviceaccount\.com", value) is not None, "Use separate staging-only service-account identities")
        accounts[key] = value
    require(len(set(accounts.values())) == 2, "Caller and worker identities must be separate")
    secret = config.get("token_secret", "")
    require(re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{2,254}", secret) is not None, "Invalid token secret reference")
    version = config.get("token_secret_version", "")
    require(isinstance(version, str) and re.fullmatch(r"[1-9][0-9]*", version) is not None, "Pin a numeric secret version, not latest")
    env = [
        {"name": "INFERENCE_API_TOKEN", "valueFrom": {"secretKeyRef": {"name": secret, "key": version}}},
        {"name": "SONRI_MODEL_REGISTRY", "value": "/config/registry.json"},
        {"name": "SONRI_MODEL_ROOT", "value": "/models"},
        {"name": "OMP_NUM_THREADS", "value": PROFILES[profile]["cpu"]},
        {"name": "OPENBLAS_NUM_THREADS", "value": PROFILES[profile]["cpu"]},
    ]
    container = {"image": image, "ports": [{"name": "http1", "containerPort": 8080}],
                 "env": env, "resources": {"limits": PROFILES[profile]},
                 "startupProbe": {"httpGet": {"path": "/healthz", "port": 8080}, "periodSeconds": 5, "timeoutSeconds": 2, "failureThreshold": 24},
                 "livenessProbe": {"httpGet": {"path": "/healthz", "port": 8080}, "periodSeconds": 30, "timeoutSeconds": 2, "failureThreshold": 3}}
    runtime = {"serviceAccountName": accounts["worker_service_account"], "containerConcurrency": 1,
               "timeoutSeconds": 120, "containers": [container]}
    bucket = config.get("model_bucket")
    registry = config.get("registry_secret")
    if bucket or registry:
        require(bool(bucket and registry and config.get("model_authorization_reference") and config.get("license_review_reference")), "Model mounts require bucket, registry, authorization and license-review references")
        require(re.fullmatch(r"[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]", bucket) is not None, "Invalid private model bucket")
        require(re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{2,254}", registry) is not None, "Invalid registry secret reference")
        registry_version = config.get("registry_secret_version")
        require(isinstance(registry_version, str) and re.fullmatch(r"[1-9][0-9]*", registry_version) is not None, "Pin a numeric registry secret version")
        runtime["volumes"] = [
            {"name": "model-store", "csi": {"driver": "gcsfuse.run.googleapis.com", "readOnly": True, "volumeAttributes": {"bucketName": bucket}}},
            {"name": "registry", "secret": {"secretName": registry, "items": [{"key": registry_version, "path": "registry.json"}]}}]
        container["volumeMounts"] = [{"name": "model-store", "mountPath": "/models"}, {"name": "registry", "mountPath": "/config"}]
    service_manifest = {"apiVersion": "serving.knative.dev/v1", "kind": "Service",
        "metadata": {"name": service, "labels": {"cloud.googleapis.com/location": region, "sonri-scope": "synthetic-staging"},
                     "annotations": {"run.googleapis.com/ingress": "all", "run.googleapis.com/maxScale": "1", "run.googleapis.com/minScale": "0", "run.googleapis.com/invoker-iam-disabled": "false"}},
        "spec": {"template": {"metadata": {"annotations": {
            "run.googleapis.com/cpu-throttling": "true", "run.googleapis.com/startup-cpu-boost": "false", "run.googleapis.com/execution-environment": "gen2"}}, "spec": runtime},
                 "traffic": [{"latestRevision": True, "percent": 100}]}}
    plan = {"mode": "OFFLINE_PLAN_ONLY", "billable_actions_executed": False, "deployment_implemented": False,
            "billing_approval_reference": config.get("billing_approval_reference"),
            "gate": "EXPLICIT_OWNER_BILLING_APPROVAL_REQUIRED_BEFORE_ANY_PROVISIONING",
            "project_id": project, "region": region, "profile": profile,
            "clinical_use": "PROHIBITED", "model_mounts_configured": bool(bucket),
            "iam": {"invoker_check_required": True, "allow_public_members": False,
                    "service_invoker_member": "serviceAccount:" + accounts["caller_service_account"],
                    "role": "roles/run.invoker", "runtime_identity": accounts["worker_service_account"],
                    "token_secret_accessor_scope": secret,
                    "registry_secret_accessor_scope": registry,
                    "model_bucket_object_viewer_scope": bucket},
            "post_deploy_checks_required": ["IAM denied without Google ID token", "IAM denied for unbound identity", "worker denied without shared token", "audience mismatch denied", "protected inventory explicitly unavailable unless separately approved", "sanitized logs and restart/recovery", "verify actual min/max scaling, request billing and image digest"]}
    return service_manifest, plan


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    service, plan = render(json.loads(args.config.read_text()))
    args.output.mkdir(parents=True, exist_ok=True)
    for filename, document in [("service.json", service), ("review-plan.json", plan)]:
        (args.output / filename).write_text(json.dumps(document, indent=2) + "\n")
    print(json.dumps({"mode": plan["mode"], "billable_actions_executed": False, "profile": plan["profile"]}))


if __name__ == "__main__":
    main()
