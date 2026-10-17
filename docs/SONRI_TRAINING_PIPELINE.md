# SONRI Training Pipeline

Updated 2026-10-16. Research implementation; no clinical or production approval.

No training performed and no compute credits consumed. Existing `dataset:prepare` exports frozen manifest/COCO only after documented permission, accepted quality, independent labels, hashes and patient/near-duplicate grouping gates. It does not copy or train images automatically.

Optional local runtime installation: `python3 -m venv /private/path/venv`, then `/private/path/venv/bin/pip install -r research/oral-vision/requirements.lock.txt`. Lock was resolved/tested on Python 3.12/macOS arm64; other hosts require a separate verified lock.

After owner-authorized images and clinician-approved cohort exist: stage normalized de-identified images outside Git, reconcile COCO file_name/hashes/dimensions, add independently reviewed negatives, freeze all splits, and pin architecture, pretrained source/hash/license, seed, optimizer, batch size, epochs and wall-clock/resource caps. Start Nano/Small/Medium/Large comparisons on identical data rather than choosing from unrelated published scores. Record checkpoint hashes, full config, resource usage and error analysis.

No automated training launcher is supplied or claimed ready because no eligible cohort exists. Existing preparation cannot yet certify reviewed negatives; see annotation guidelines. Colab free GPU is optional, capacity not guaranteed, and patient transfer requires explicit processing authorization. No external job was launched.
