"""Offline arithmetic scenarios; no cloud account access or promises of a free bill."""
import argparse
from decimal import Decimal, ROUND_CEILING
import json
from pathlib import Path

PRICING = json.loads(Path(__file__).with_name("pricing.2026-10.json").read_text())
PROFILES = {"onnx-cpu": (1, 2), "yolo-cpu": (2, 4)}


def dec(value):
    result = Decimal(str(value))
    if not result.is_finite() or result < 0:
        raise ValueError("Finite nonnegative workload values required")
    return result


def billed(value):
    return (dec(value) * 10).to_integral_value(rounding=ROUND_CEILING) / 10


def estimate(region, profile, requests, average_seconds, cold_starts=0, startup_seconds=0, shutdown_seconds=1):
    if region not in ["us-central1", "asia-southeast2"] or profile not in PROFILES:
        raise ValueError("Unsupported verified region or worker profile")
    if not isinstance(requests, int) or isinstance(requests, bool) or requests < 0:
        raise ValueError("Request count must be a nonnegative integer")
    if not isinstance(cold_starts, int) or isinstance(cold_starts, bool) or not 0 <= cold_starts <= requests:
        raise ValueError("Cold starts must be an integer from zero to request count")
    if dec(average_seconds) > 120 or dec(startup_seconds) > 120:
        raise ValueError("Scenario exceeds configured request/startup time budget")
    seconds = requests * billed(average_seconds) + cold_starts * (billed(startup_seconds) + billed(shutdown_seconds))
    cpu, memory = PROFILES[profile]
    rates = PRICING[region]
    gross = {"cpu": seconds * cpu * dec(rates["cpu_per_vcpu_second"]),
             "memory": seconds * memory * dec(rates["memory_per_gib_second"]),
             "requests": requests * dec(rates["per_request"])}
    net = {key: max(Decimal(0), value - dec(PRICING["monthly_maximum_shared_free_credit_usd"][key])) for key, value in gross.items()}
    money = lambda value: str(value.quantize(Decimal("0.000001")))
    return {"region": region, "profile": profile, "requests": requests,
            "average_request_seconds": str(dec(average_seconds)), "cold_starts": cold_starts,
            "startup_seconds_per_cold_start": str(dec(startup_seconds)),
            "shutdown_seconds_per_cold_start": str(dec(shutdown_seconds)),
            "computed_billable_instance_seconds": str(seconds),
            "gross_compute_and_requests_usd": money(sum(gross.values())),
            "net_if_entire_shared_free_credit_available_usd": money(sum(net.values())),
            "net_if_free_credit_already_consumed_usd": money(sum(gross.values())),
            "gross_by_sku_usd": {key: money(value) for key, value in gross.items()},
            "net_by_sku_if_full_credit_usd": {key: money(value) for key, value in net.items()},
            "assumptions": ["One sequential request per instance; request durations treated as constant averages rounded up to 100 ms", "Startup and graceful shutdown are billable and modeled separately", "No warm idle instances (minimum instances 0); no startup CPU boost", "These are workload assumptions, not measured inference latency", "Shared free credits cannot be claimed independently for every scenario/service/project", "Excluded services, tax and data transfer are additional; budget alerts and maximum instances 1 are not a spending cap"],
            "not_a_total_project_bill": True}


def scenarios():
    definitions = [
        ("No requests", "onnx-cpu", 0, 0, 0, 0),
        ("Small synthetic staging", "onnx-cpu", 1000, 2, 50, 8),
        ("10000 requests at 5 s", "onnx-cpu", 10000, 5, 200, 10),
        ("100000 requests at 5 s", "onnx-cpu", 100000, 5, 500, 10),
        ("Long CPU requests", "onnx-cpu", 1000, 60, 100, 15),
        ("Optional YOLO CPU", "yolo-cpu", 10000, 10, 500, 20),
        ("Continuous full utilization for 30 days", "onnx-cpu", 518400, 5, 0, 0),
    ]
    return {"source": PRICING["source"], "verified_client_date": PRICING["verified_client_date"],
            "currency": "USD", "billing": "REQUEST_BASED", "region": "asia-southeast2",
            "scenarios": [{"name": name, **estimate("asia-southeast2", profile, count, seconds, cold, startup)} for name, profile, count, seconds, cold, startup in definitions],
            "excluded": PRICING["excluded"], "billable_actions_executed": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--region", default="asia-southeast2")
    parser.add_argument("--profile", default="onnx-cpu")
    parser.add_argument("--requests", type=int)
    parser.add_argument("--average-seconds", default="5")
    parser.add_argument("--cold-starts", type=int, default=0)
    parser.add_argument("--startup-seconds", default="0")
    parser.add_argument("--shutdown-seconds", default="1")
    args = parser.parse_args()
    result = scenarios() if args.requests is None else estimate(args.region, args.profile, args.requests, args.average_seconds, args.cold_starts, args.startup_seconds, args.shutdown_seconds)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
