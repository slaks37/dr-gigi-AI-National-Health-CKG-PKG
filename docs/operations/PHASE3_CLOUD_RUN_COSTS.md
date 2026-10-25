# Cloud Run CPU staging cost review

Prices were checked on the [official Cloud Run pricing page](https://cloud.google.com/run/pricing), including selecting Jakarta in its interactive request-billing table. The source snapshot and offline calculator are `ops/cloud-run/pricing.2026-10.json` and `ops/cloud-run/costs.py`. These are USD workload scenarios, not measured model latency, a provider quotation or a promise of a zero bill.

| Request-billed resource | Iowa `us-central1` | Jakarta `asia-southeast2` |
| --- | --- | --- |
| Active vCPU-second | $0.000024 | $0.0000336 |
| Active GiB-second | $0.0000025 | $0.0000035 |
| One million requests | $0.40 | $0.40 |

The monthly request-billing free allowances are based on Tier 1: 180,000 vCPU-seconds, 360,000 GiB-seconds and two million requests. Applied as USD credits, these are at most $4.32 CPU, $0.90 memory and $0.80 requests, aggregated across projects under the billing account. They are separate resource discounts; spare request credit cannot cancel CPU charges. The Jakarta calculator therefore subtracts the applicable **dollar** credit from each SKU, rather than treating the Tier 1 unit counts as the Jakarta free unit count.

Initial ONNX candidate: one CPU, 2 GiB, concurrency1, min0/max1. YOLO candidate: two CPUs and 4 GiB. The calculator rounds each assumed constant request duration and each startup/shutdown period upward to 100 ms. It includes one second of graceful shutdown per assumed cold start. Cold starts and model loading are engineering assumptions until measured. Request billing includes startup and shutdown, as described in [billing settings](https://docs.cloud.google.com/run/docs/configuring/billing-settings).

| Monthly Jakarta scenario | Assumed cold starts / startup seconds | Compute + requests before free credits | If all applicable shared credits remain |
| --- | --- | --- | --- |
| No requests, min0 | 0 | $0.000000 | $0.000000 |
| ONNX 1,000 requests, 2s each | 50 / 8s | $0.099870 | $0.000000 |
| ONNX 10,000 requests, 5s each | 200 / 10s | $2.123320 | $0.000000 |
| ONNX 100,000 requests, 5s each | 500 / 10s | $20.563300 | $15.303300 |
| ONNX 1,000 requests, 60s each | 100 / 15s | $2.501360 | $0.000000 |
| Optional YOLO 10,000 requests, 10s each | 500 / 20s | $8.976600 | $3.752600 |
| ONNX fully busy for 30 days, 5s/request | Excludes extra cold-start overhead | $105.442560 | $100.015200 |

The last row illustrates why max1 is not a monetary cap. It is a workload example, not a worst-case bill. Cloud Run can briefly exceed a maximum during replacement/scaling, and other services can keep charging. A worker secret/IAM mistake, retry loop or unexpectedly slow inference can increase billable time. A zero in the free-credit column assumes those shared credits have not already been consumed elsewhere. No inference request latency has been measured by this cost calculator.

These figures exclude image build/storage, model object storage/read operations, secret access, Firebase/Firestore, logging above allowances, external or cross-region traffic, VPC/load-balancer components, taxes and account currency conversion. An idle min0 service can still incur artifact/model storage and other project charges. Jakarta residency and service compatibility must be approved independently of cost. Do not move patient data to a cheaper region without the owner's explicit data-governance approval.

Choose an owner-approved budget and recipient plan before provisioning. Alerts-only budgets notify; they do not stop usage or billing. Google documents this distinction in [Cloud Billing budgets](https://docs.cloud.google.com/billing/docs/how-to/budgets). Any actual spend-cap feature or automated disable response must be verified for the selected services/account and separately authorized; no such cap or shutdown automation is configured here. The current review candidate does not purchase or enable anything.

Reproduce every number with:

```sh
python3 ops/cloud-run/costs.py
python3 ops/cloud-run/costs.py --region asia-southeast2 --profile onnx-cpu --requests 100000 --average-seconds 5 --cold-starts 500 --startup-seconds 10
```

The generated full scenario record is `docs/operations/PHASE3_CLOUD_RUN_COST_SCENARIOS.json`. Refresh the official regional pricing and workload assumptions immediately before any approval or deployment. The exact owner approval, project/billing/IAM access, image upload and actual hosted acceptance remain pending.
