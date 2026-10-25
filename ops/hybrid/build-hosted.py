"""Build the existing research APK from an approved PUBLIC google-services.json only."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--client-config', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    approval = json.loads((ROOT / 'ops/hybrid/owner-approval.v1.json').read_text())
    data = json.loads(args.client_config.read_text())
    if data.get('type') == 'service_account' or 'private_key' in data or 'client_email' in data:
        raise ValueError('PUBLIC_ANDROID_CLIENT_CONFIGURATION_ONLY')
    if data['project_info']['project_id'] != approval['projectId'] or approval['billingAccountLinkAllowed'] is not False:
        raise ValueError('EXACT_OWNER_APPROVED_UNBILLED_PROJECT_REQUIRED')
    client = next(c for c in data['client'] if c['client_info'].get('android_client_info', {}).get('package_name') == 'id.sonri.offline.research')
    web = next(c['client_id'] for c in client['oauth_client'] if c['client_type'] == 3)
    public = {'sonriProject': approval['projectId'], 'sonriAppId': client['client_info']['mobilesdk_app_id'],
              'sonriApiKey': client['api_key'][0]['current_key'], 'sonriGoogleClientId': web,
              'sonriProjectApproval': approval['approvalReference'], 'sonriEmulators': 'false', 'sonriConnectedTests': 'true'}
    args.output.mkdir(parents=True, exist_ok=True)
    with (args.output / 'build.log').open('w') as log:
        result = subprocess.run(['./gradlew', ':app:assembleConnected', ':app:assembleConnectedAndroidTest',
                                 ':app:testDebugUnitTest', ':app:lintConnected', '--no-daemon'] +
                                ['-P' + k + '=' + v for k, v in public.items()],
                                cwd=ROOT / 'apps/android', env=os.environ.copy(), stdout=log, stderr=subprocess.STDOUT)
    if result.returncode:
        raise RuntimeError('BUILD_FAILED_SEE_LOCAL_LOG_NO_CONFIG_EMITTED')
    for source, target in [('connected/app-connected.apk', 'sonri-hybrid-connected-hosted.apk'),
                           ('androidTest/connected/app-connected-androidTest.apk', 'sonri-hybrid-hosted-tests.apk')]:
        shutil.copyfile(ROOT / 'apps/android/app/build/outputs/apk' / source, args.output / target)
    rows = [hashlib.sha256(p.read_bytes()).hexdigest() + '  ' + p.name for p in sorted(args.output.glob('*.apk'))]
    (args.output / 'SHA256SUMS.txt').write_text('\n'.join(rows) + '\n')
    print(json.dumps({'projectId': approval['projectId'], 'publicClientConfigurationOnly': True,
                      'clinicalUse': 'PROHIBITED', 'apk': str(args.output / 'sonri-hybrid-connected-hosted.apk')}))


if __name__ == '__main__':
    main()
