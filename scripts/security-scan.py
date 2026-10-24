#!/usr/bin/env python3
"""Find recognizable credential literals without emitting values or fingerprints.

Default: Git-tracked and non-ignored untracked working files. Remote mode fetches
one pinned GitHub source in memory via gh. This is a targeted regression check,
not a replacement for provider revocation, GitHub secret scanning or a history audit.
"""
import argparse
import base64
import json
from pathlib import Path
import re
import subprocess
import sys


PATTERNS = {
    "OPENAI_STYLE_SECRET": re.compile(r"\bsk-[A-Za-z0-9_-]{20,}"),
    "GITHUB_SECRET": re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})"),
    "PRIVATE_KEY": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "AWS_ACCESS_KEY_ID_REQUIRES_OWNER_REVIEW": re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b"),
}
MAX_BYTES = 2_000_000


def inspect_text(content, path):
    """Return locations and kinds only; never source excerpts or token hashes."""
    return [
        {"path": path, "line": number, "kind": kind}
        for number, line in enumerate(content.splitlines(), 1)
        for kind, pattern in PATTERNS.items()
        if pattern.search(line)
    ]


def command(args, cwd=None):
    result = subprocess.run(args, cwd=cwd, capture_output=True, check=False)
    if result.returncode:
        # Captured command output could contain sensitive source or configuration.
        raise RuntimeError("Read command failed; output suppressed")
    return result.stdout


def working_files(root):
    names = command(["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"], root)
    findings, skipped, scanned = [], [], 0
    for name in sorted(set(names.decode().split("\0")) - {""}):
        path = root / name
        if path.is_symlink():
            skipped.append({"path": name, "reason": "SYMLINK_NOT_FOLLOWED"})
            continue
        if not path.exists():
            continue  # Deleted working files cannot be committed as new literals.
        if not path.is_file() or path.stat().st_size > MAX_BYTES:
            skipped.append({"path": name, "reason": "OVERSIZE_OR_NON_FILE"})
            continue
        data = path.read_bytes()
        if b"\0" in data:
            skipped.append({"path": name, "reason": "BINARY"})
            continue
        try:
            source = data.decode("utf-8")
        except UnicodeDecodeError:
            skipped.append({"path": name, "reason": "NON_UTF8"})
            continue
        scanned += 1
        findings.extend(inspect_text(source, name))
    return {"scope": "WORKING_FILES_NOT_GIT_HISTORY", "scanned_text_files": scanned,
            "skipped": skipped, "findings": findings}


def github_source(repository, ref, path):
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repository):
        raise ValueError("Expected owner/repository")
    if not re.fullmatch(r"[a-fA-F0-9]{40}", ref):
        raise ValueError("Remote source must be pinned to a full commit SHA")
    if path.startswith("/") or ".." in Path(path).parts or "?" in path or "#" in path:
        raise ValueError("Expected a repository-relative source path")
    entry = json.loads(command(["gh", "api", f"repos/{repository}/contents/{path}?ref={ref}"]))
    if entry.get("encoding") != "base64" or entry.get("size", MAX_BYTES + 1) > MAX_BYTES:
        raise ValueError("Source is too large or not supported")
    source = base64.b64decode(entry["content"], validate=False).decode("utf-8")
    return {"scope": "PINNED_GITHUB_SOURCE", "repository": repository, "commit": ref,
            "path": path, "git_blob_sha": entry["sha"], "scanned_text_files": 1,
            "findings": inspect_text(source, path), "raw_source_persisted": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--github", help="Read-only owner/repository; requires --ref and --path")
    parser.add_argument("--ref", help="Full immutable Git commit SHA")
    parser.add_argument("--path", help="Repository-relative UTF-8 source path")
    parser.add_argument("--output", type=Path, help="Optional redacted JSON report")
    args = parser.parse_args()
    try:
        if args.github:
            if not args.ref or not args.path:
                raise ValueError("Remote mode requires --ref and --path")
            report = github_source(args.github, args.ref, args.path)
        else:
            if args.ref or args.path:
                raise ValueError("--ref and --path require --github")
            report = working_files(args.root.resolve())
        report.update({"schema_version": "sonri.redacted-credential-scan.v1",
                       "secret_values_emitted": False, "secret_fingerprints_emitted": False,
                       "finding_count": len(report["findings"]), "patterns_only": True})
        output = json.dumps(report, indent=2) + "\n"
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(output)
        print(output, end="")
        return 1 if report["findings"] else 0
    except Exception:
        # Do not echo exception arguments, stdout/stderr, or source-bearing URLs.
        print(json.dumps({"error": "SCAN_FAILED", "details_suppressed": True}))
        return 2


if __name__ == "__main__":
    sys.exit(main())
