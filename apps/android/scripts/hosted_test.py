"""Opt-in staged REAL Spark acceptance. Private credentials travel only via adb stdin to no_backup.

No project/account is created until the operator explicitly invokes the register stage.
The private input JSON must be owner-readable only (chmod 600), never committed or passed as CLI values.
This runner does not read inboxes, apply action codes, use Admin SDK, or distribute the APK.
"""
import argparse
import hashlib
import json
import os
import stat
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from emulator_unlock import unlock

PACKAGE = "id.sonri.offline.research"
STAGES = ("register", "accept", "other-denial", "recovery-request", "recovery-confirm")


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--adb", default="adb")
    parser.add_argument("--serial", required=True)
    parser.add_argument("--apk", type=Path, required=True)
    parser.add_argument("--test-apk", type=Path, required=True)
    parser.add_argument("--input", type=Path, required=True, help="private mode-600 JSON path, never a password")
    parser.add_argument("--stage", choices=STAGES, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--setup-emulator", action="store_true", help="unlock dedicated qemu with the existing synthetic PIN")
    args = parser.parse_args()
    mode = args.input.stat().st_mode
    if not stat.S_ISREG(mode) or mode & 0o077 or args.input.stat().st_uid != os.getuid():
        raise ValueError("PRIVATE_OWNER_READABLE_MODE_600_INPUT_REQUIRED")
    if args.input.stat().st_size > 16_384:
        raise ValueError("PRIVATE_INPUT_TOO_LARGE")
    private = json.loads(args.input.read_text())
    if not isinstance(private, dict):
        raise ValueError("PRIVATE_INPUT_OBJECT_REQUIRED")
    private["stage"] = args.stage
    run_id = private.get("runId", "")
    import re
    if not re.fullmatch(r"[a-z0-9-]{8,64}", run_id):
        raise ValueError("SAFE_NONSECRET_RUN_ID_REQUIRED")
    approved = private.get("approvedProject", "")
    if not approved.startswith("sonri-hybrid-") or private.get("authorizeSyntheticAccountOperations") is not True:
        raise ValueError("EXACT_APPROVED_PROJECT_AND_EXPLICIT_SYNTHETIC_AUTHORIZATION_REQUIRED")
    payload = json.dumps(private, separators=(",", ":")).encode()
    del private
    base = [args.adb, "-s", args.serial]

    def adb(*command, payload=None, check=True, timeout=240):
        result = subprocess.run(base + list(command), input=payload, capture_output=True, timeout=timeout)
        if check and result.returncode:
            # Never expose SDK/adb output that could contain private input or credentials.
            raise RuntimeError("ANDROID_COMMAND_FAILED_PRIVATE_OUTPUT_WITHHELD")
        return result.stdout.decode("utf-8", errors="replace")

    if adb("shell", "getprop", "ro.kernel.qemu").strip() != "1":
        raise ValueError("DEDICATED_SYNTHETIC_ANDROID_EMULATOR_REQUIRED")
    android = Path(__file__).resolve().parents[1]

    def sources():
        files = list((android / "app/src").rglob("*")) + [android / "app/build.gradle.kts", Path(__file__).resolve()]
        return {str(path.relative_to(android)): digest(path) for path in sorted(files)
                if path.is_file() and "/assets/generated/" not in path.as_posix()}

    before = sources()
    apk_sha = digest(args.apk)
    test_sha = digest(args.test_apk)
    args.output.mkdir(parents=True, exist_ok=True)
    adb("shell", "settings", "put", "global", "airplane_mode_on", "0")
    adb("shell", "svc", "wifi", "enable")
    adb("shell", "svc", "data", "enable")
    if args.setup_emulator:
        unlock(adb)
    adb("install", "-r", "-t", str(args.apk))
    adb("install", "-r", "-t", str(args.test_apk))
    adb("shell", "run-as", PACKAGE, "rm", "-f", "no_backup/hosted-evidence.json", "no_backup/hosted-input.json")
    # Quoting here is a fixed literal, not interpolation of a password, project or mailbox.
    adb("shell", "run-as", PACKAGE, "sh", "-c", "'umask 077; mkdir -p no_backup; cat > no_backup/hosted-input.json'", payload=payload)
    del payload
    try:
        raw = adb("shell", "am", "instrument", "-w", "-r", "-e", "class", "id.sonri.offline.HostedFirebaseTest",
                  PACKAGE + ".test/androidx.test.runner.AndroidJUnitRunner", timeout=300)
    finally:
        adb("shell", "run-as", PACKAGE, "rm", "-f", "no_backup/hosted-input.json", check=False)
    # Deliberately retain only a digest of the raw instrumentation output, never its credential-bearing exception text.
    raw_sha = hashlib.sha256(raw.encode()).hexdigest()
    instrument_ok = "OK (1 test)" in raw and "FAILURES!!!" not in raw
    del raw
    report = json.loads(adb("exec-out", "run-as", PACKAGE, "cat", "no_backup/hosted-evidence.json"))
    if report.get("run_id") != run_id or report.get("stage") != args.stage or report.get("approved_project") != approved:
        raise RuntimeError("HOSTED_EXECUTION_BINDING_MISMATCH")
    if report.get("use_emulators") is not False or report.get("apk_sha256") != apk_sha or report.get("instrumentation_apk_sha256") != test_sha:
        raise RuntimeError("HOSTED_APK_OR_ENDPOINT_BINDING_MISMATCH")
    if sources() != before or digest(args.apk) != apk_sha or digest(args.test_apk) != test_sha:
        raise RuntimeError("TESTED_SOURCE_OR_APK_DRIFT")
    report.update({"host_recorded_at_utc": datetime.now(timezone.utc).isoformat(),
                   "stable_source_sha256": before, "instrumentation_output_sha256": raw_sha,
                   "instrumentation_completed": instrument_ok,
                   "credential_input_retained_in_evidence": False,
                   "owner_private_input_file_deleted": False,
                   "billing_or_project_emptiness_verified_by_this_test": False,
                   "product_ui_acceptance": False})
    path = args.output / f"{run_id}-{args.stage}.json"
    path.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({key: report[key] for key in ("stage", "status", "approved_project", "scope", "instrumentation_completed")}))
    if not instrument_ok or report.get("status") == "FAIL":
        raise RuntimeError("HOSTED_STAGE_FAILED_SEE_REDACTED_EVIDENCE")


if __name__ == "__main__":
    try:
        main()
    except Exception as failure:
        # Do not print arbitrary parser/SDK/subprocess exception strings or private input values.
        raise SystemExit("HOSTED_RUNNER_FAILED_" + type(failure).__name__) from None
