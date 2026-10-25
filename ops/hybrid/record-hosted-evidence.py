"""Record actual hosted outcomes, including blockers; never convert failures into success."""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SHA = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execution', type=Path, required=True)
    parser.add_argument('--prior-execution', type=Path, help='Optional dated registration/mail history; never treated as final-APK acceptance')
    args = parser.parse_args()
    work = args.execution
    read = lambda p: json.loads(p.read_text())
    approval = read(ROOT / 'ops/hybrid/owner-approval.v1.json')
    preflight = read(work / 'preflight-final.json')
    distribution = read(work / 'app-distribution-release.json')
    group = read(work / 'distribution-group.json')
    static = read(work / 'apk-static.json')
    stages = [read(p) for p in (work / 'acceptance').glob('*.json')]
    accepted = next(s for s in stages if s.get('stage') == 'accept' and s['status'] == 'PASS')
    recovery = max((s for s in stages if s.get('stage') == 'recovery-confirm'), key=lambda s: s['executed_at_utc'])
    denial = next(s for s in stages if s.get('stage') == 'other-denial' and s['status'] == 'PASS')
    host = read(work / 'offline-ai/host-execution.json')
    rf = read(work / 'offline-ai/pretrained-device-evidence.json')
    assert preflight['projectId'] == accepted['approved_project'] == recovery['approved_project'] == denial['approved_project'] == approval['projectId']
    assert preflight['noBillingVerified'] and preflight['billing']['billingEnabled'] is False and preflight['billing']['billingAccountLinked'] is False
    assert preflight['auth']['emailPasswordEnabled'] and preflight['auth']['googleEnabled'] and preflight['dedicatedRules']['exactReviewedSource']
    assert len(preflight['databases']) == 1 and preflight['databases'][0]['locationId'] == approval['firestoreLocation']
    assert preflight['databases'][0]['databaseEdition'] == 'STANDARD'
    assert preflight['databases'][0]['pointInTimeRecoveryEnablement'] == 'POINT_IN_TIME_RECOVERY_DISABLED'
    apk = work / 'sonri-hybrid-connected-hosted.apk'
    assert SHA(apk) == static['sha256'] == accepted['apk_sha256'] == recovery['apk_sha256'] == denial['apk_sha256'] == host['apk_sha256'] == distribution['downloadedApkSha256']
    assert distribution['matchesTestedLocalApk'] and group['onlyApprovedOwner'] and group['testerCount'] == 1
    assert group['groups'][0]['inviteLinkCount'] == 0 and static['pretrained_model_bundled'] is False
    assert denial['results']['verified_other_account_denial'].startswith('PASS_REAL_SERVER_PERMISSION_DENIED')
    assert rf['airplane_mode_observed'] and rf['clinical_validation'] is False and host['pretrained_inference'] == 'ACTUAL_PRETRAINED_ANDROID_EXECUTION'
    for stage in (accepted, recovery, denial):
        assert stage['use_emulators'] is False
        assert stage['instrumentation_completed'] == (stage['status'] == 'PASS')
        assert all(SHA(ROOT / 'apps/android' / p) == h for p, h in stage['stable_source_sha256'].items())
    assert all(SHA(ROOT / 'apps/android' / p) == h for p, h in host['tested_source_sha256'].items())
    recovery_passed = recovery['status'] == 'PASS'
    if recovery_passed:
        assert recovery['results']['password_reset_reauthentication_and_restore'].startswith('PASS_')
    else:
        assert recovery['status'] == 'FAIL' and recovery['last_step'] == 'REAL_EMAIL_LOGIN'
        assert recovery['results']['outer_failure_auth_code'] == 'ERROR_INVALID_CREDENTIAL'
    history = []
    if args.prior_execution:
        for path in sorted((args.prior_execution / 'acceptance').glob('*.json')):
            stage = read(path)
            if stage.get('stage') not in ('register', 'recovery-request'):
                continue
            assert stage['approved_project'] == approval['projectId'] and stage['use_emulators'] is False
            # Preserve dated failures and waits. These hashes belong to the earlier binary.
            history.append({k: stage[k] for k in ('stage', 'status', 'executed_at_utc', 'last_step', 'apk_sha256', 'results', 'scope')})
    out = {'schema': 'sonri.hybrid.real-hosted-acceptance.v1', 'continued_from': '82aa78199c6813e7a9599c049269e0f7ab716749',
           'status': 'REAL_HOSTED_CORE_AND_RECOVERY_PASS' if recovery_passed else 'REAL_HOSTED_CORE_PASS_PASSWORD_RECOVERY_BLOCKED',
           'definitionOfDoneAchieved': False, 'approval': approval, 'providerPreflight': preflight,
           'apkStatic': static, 'hostedAcceptance': accepted, 'hostedOtherAccountDenial': denial, 'hostedRecovery': recovery,
           'priorRegistrationAndMailHistory': history,
           'offlineHost': host, 'actualRfdetrEmulator': rf, 'appDistribution': distribution, 'testerGroup': group,
           'clinicalUse': 'PROHIBITED', 'realPatientSyncEnabled': False, 'physicalPhonesTested': 0,
           'actualGoogleCredentialManagerUiTested': False, 'actualProviderQuotaExhausted': False,
           'limits': ([] if recovery_passed else ['Password recovery remains blocked: the owner-supplied replacement password is rejected by Firebase; no new-password restore is claimed.']) +
                     ['Independent named Firebase clients on one Android emulator, not two physical phones or complete product UI acceptance.',
                      'Owner-reported physical-phone analysis failure has a readiness/inline-feedback fix, but no post-fix phone execution has been observed.',
                      'Quota failure is explicitly injected RESOURCE_EXHAUSTED; no Spark quota was deliberately exhausted.',
                      'Raw labels and disease provenance remain unverified; private weights are not publicly redistributed.',
                      'The original credential incident remains open without nonsecret owner revocation evidence.']}
    (ROOT / 'apps/android/evidence/firebase-hosted.v1.json').write_text(json.dumps(out, indent=2) + '\n')
    print(json.dumps({'projectId': approval['projectId'], 'status': out['status'], 'apkSha256': static['sha256']}))


if __name__ == '__main__':
    main()
