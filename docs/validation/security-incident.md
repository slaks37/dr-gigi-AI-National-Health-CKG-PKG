# Supporting-repository credential exposure

Latest incident state: [Phase 3 follow-up](phase3-security-status.md), **OPEN / AWAITING_OWNER_ATTESTATION**. The Phase 2 record below preserves the prior deferral and original location evidence.

Verified by read-only GitHub API on **2026-10-24 (Asia/Jakarta)**. **OPEN — DEFERRED_BY_OWNER: revocation/rotation is not verified.** Clinical use remains prohibited. No credential was tested against its provider, copied to this repository, or included in reports/logs.

| Evidence | Recorded value |
| --- | --- |
| Repository | `slaks37/Sonri-untuk-Negeri` (supporting repository, separate from this PR) |
| Live `main` head and inspected immutable revision | `b43c2fe614a1ba96da0094ed6271398bd7479a8d` |
| Source location | [`app/checkup/page.tsx:301`](https://github.com/slaks37/Sonri-untuk-Negeri/blob/b43c2fe614a1ba96da0094ed6271398bd7479a8d/app/checkup/page.tsx#L301) |
| Exposure | Hard-coded OpenAI-style API credential in browser application source |
| Browser execution evidence | Adjacent line 302 enables `dangerouslyAllowBrowser` |
| Reproduction | [Location-only scanner result](security-source-exposure.json); one finding, expected exit status 1 |
| Current credential validity or abuse | Unknown; no authentication probe or provider-account access attempted |
| Owner action | **DEFERRED_BY_OWNER** on 2026-10-24: owner requested continuing independent work and rotating later. Revocation is not confirmed. Revoke/rotate through the owner's secure provider console and secret-management channel; do not test or use the exposed key. |

The source Git blob identifier in the JSON identifies the complete source file; **no token fingerprint, prefix/suffix, token value, raw source, or source excerpt is retained**. Public Firebase browser configuration is not treated as an Admin credential by this check.

## Required incident closure

The owner must identify the affected provider project/account privately, revoke the exposed key, inspect provider usage/security logs for its exposure interval, and determine whether any unapproved image transfers occurred. Report account details, replacement keys, logs containing personal information and incident investigation through an approved secure channel; do not paste them into a PR, chat, CI log or issue. Provision any replacement only as a restricted server-side secret. Verify replacement authentication using the replacement through the authorized application flow; do not probe the exposed credential.

The separate supporting repository still contains the exposure at the verified head. Its owner must remove the client literal, disable browser use of provider secrets, rebuild/redeploy affected bundles, and assess caches and Git history. Source deletion or history cleanup alone does not revoke the key. This Phase 2 change documents the incident and adds a regression check to this application; it does not claim remediation of the supporting repository or provider account.

Closure evidence should contain only an incident identifier, responsible owner, revocation/rotation completion time, affected nonsecret configuration references, confirmation of source/deployment cleanup, and confirmation that the provider usage review completed. No such owner attestation is available in this run. The owner explicitly deferred rotation; this leaves the incident OPEN and does not authorize use or testing of the exposed key. Reuse of the affected provider/account requires closure; independent synthetic staging with separate credentials can continue. Clinical rollout remains prohibited pending the full validation requirements.

## Reproducible regression checks

```sh
python3 -B scripts/security-scan.test.py
python3 -B scripts/security-scan.py
python3 -B scripts/security-scan.py \
  --github slaks37/Sonri-untuk-Negeri \
  --ref b43c2fe614a1ba96da0094ed6271398bd7479a8d \
  --path app/checkup/page.tsx
```

Exit status: 0 means no recognized pattern in the scanned scope; 1 means findings; 2 means the scan failed. The remote command is read-only, requires an authenticated `gh` CLI/network access, and processes source only in memory. The last command is expected to fail with a single redacted location while that historical revision remains unchanged.

The local default includes tracked and non-ignored untracked working files, excludes Git history/ignored files, skips symlinks, binary/non-UTF8 and files over 2 MB, and reports all skips. It recognizes several common provider-secret/private-key formats. Arbitrary credentials, provider validity, deployed bundles, repository history, private `.env`/secret stores and permissions require separate owner checks. Passing the scanner is a regression result, not security clearance.
