import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


render = module("cloud_run_render", Path(__file__).with_name("render.py")).render
costs = module("cloud_run_costs", Path(__file__).with_name("costs.py"))
entrypoint = module("cloud_run_entrypoint", ROOT / "services/inference/cloud_run_entrypoint.py")


class CloudRunCandidateTests(unittest.TestCase):
    def config(self):
        config = json.loads(Path(__file__).with_name("staging.example.json").read_text())
        config["image"] = config["image"].split("@sha256:")[0] + "@sha256:" + "a" * 64
        return config

    def test_render_default_is_private_plan_with_bounded_request_billing(self):
        service, plan = render(self.config())
        self.assertFalse(plan["billable_actions_executed"])
        self.assertFalse(plan["deployment_implemented"])
        self.assertFalse(plan["iam"]["allow_public_members"])
        self.assertEqual(service["metadata"]["annotations"]["run.googleapis.com/maxScale"], "1")
        runtime = service["spec"]["template"]["spec"]
        self.assertEqual(runtime["containerConcurrency"], 1)
        self.assertEqual(runtime["timeoutSeconds"], 120)
        self.assertEqual(runtime["containers"][0]["ports"][0]["containerPort"], 8080)
        self.assertNotIn("volumes", runtime)
        env = runtime["containers"][0]["env"][0]
        self.assertNotIn("value", env)
        self.assertEqual(env["valueFrom"]["secretKeyRef"]["key"], "1")

    def test_reject_unpinned_image_secret_and_plaintext_or_expansion_fields(self):
        for key, value in [("image", "image:latest"), ("token_secret_version", "latest"), ("service", "sonri-production"), ("profile", "gpu"), ("INFERENCE_API_TOKEN", "synthetic-plaintext-token"), ("max_instances", 20)]:
            with self.subTest(key=key), self.assertRaises(ValueError):
                render(self.config() | {key: value})

    def test_reject_shared_runtime_and_caller_identity(self):
        config = self.config()
        config["caller_service_account"] = config["worker_service_account"]
        with self.assertRaises(ValueError):
            render(config)

    def test_model_mounts_require_rights_and_versioned_registry_and_are_readonly(self):
        config = self.config() | {"model_bucket": "synthetic-private-models"}
        with self.assertRaises(ValueError):
            render(config)
        config.update(registry_secret="reviewed-registry", registry_secret_version="2", model_authorization_reference="synthetic-review-reference", license_review_reference="synthetic-rights-reference")
        service, _ = render(config)
        self.assertTrue(service["spec"]["template"]["spec"]["volumes"][0]["csi"]["readOnly"])

    def test_optional_yolo_profile_requires_license_record_and_is_cpu_only(self):
        config = self.config() | {"profile": "yolo-cpu"}
        with self.assertRaises(ValueError):
            render(config)
        service, _ = render(config | {"license_review_reference": "synthetic-license-review"})
        limits = service["spec"]["template"]["spec"]["containers"][0]["resources"]["limits"]
        self.assertEqual(limits, {"cpu": "2", "memory": "4Gi"})

    def test_cloud_run_port_contract_and_input_validation(self):
        for raw, expected in [("8080", "8080"), ("8091", "8091")]:
            command = entrypoint.command({"PORT": raw})
            self.assertIn("0.0.0.0", command)
            self.assertEqual(command[command.index("--port") + 1], expected)
            self.assertEqual(command[command.index("--workers") + 1], "1")
        for raw in ["0", "65536", "8000;anything", "-1", "８０８０"]:
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                entrypoint.command({"PORT": raw})

    def test_jakarta_free_credit_is_dollar_credit_per_sku(self):
        result = costs.estimate("asia-southeast2", "onnx-cpu", 100000, 5, 500, 10)
        self.assertEqual(result["computed_billable_instance_seconds"], "505500")
        self.assertEqual(result["gross_compute_and_requests_usd"], "20.563300")
        self.assertEqual(result["net_if_entire_shared_free_credit_available_usd"], "15.303300")
        self.assertEqual(result["net_by_sku_if_full_credit_usd"]["requests"], "0.000000")

    def test_zero_requests_and_nonfree_workload_rounding(self):
        self.assertEqual(costs.estimate("asia-southeast2", "onnx-cpu", 0, 0)["gross_compute_and_requests_usd"], "0.000000")
        self.assertEqual(costs.estimate("asia-southeast2", "onnx-cpu", 10, "0.11")["computed_billable_instance_seconds"], "2.0")
        for values in [(1, "NaN", 0), (-1, 1, 0), (1, 121, 0), (1, 1, 2)]:
            with self.subTest(values=values), self.assertRaises(ValueError):
                costs.estimate("asia-southeast2", "onnx-cpu", *values)


if __name__ == "__main__":
    unittest.main()
