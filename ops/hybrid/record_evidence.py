"""Normalize completed synthetic execution; never include keys, patient records or provider tokens."""
import argparse,hashlib,json,re,xml.etree.ElementTree as ET
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def read(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--execution',type=Path,required=True);a=p.parse_args();work=a.execution
 host=read(work/'primary-offline/host-execution.json');pretrained=read(work/'primary-offline/pretrained-device-evidence.json');connected=read(work/'connected-final/execution.json');apk=read(work/'connected-apk.json')
 assert host['software_instrumentation']=='PASS' and host['pretrained_inference']=='ACTUAL_PRETRAINED_ANDROID_EXECUTION'
 assert host['apk_sha256']==apk['sha256']==sha(work/'sonri-hybrid-research-connected.apk')
 assert pretrained['internet_permission'] is True and pretrained['physical_phone_tested'] is False
 assert connected['tests_passed']==2 and connected['hosted_firebase'] is False
 assert all(sha(ROOT/'apps/android'/path)==value for path,value in connected['stable_source_sha256'].items())
 assert all(sha(ROOT/'apps/android'/path)==value for path,value in host['tested_source_sha256'].items())
 def tests(path):
  text=path.read_text();assert 'FAILURES!!!' not in text and 'OK (' in text
  passed=skipped=0;named=False
  for line in text.splitlines():
   if line.startswith('INSTRUMENTATION_STATUS: test='):named=True
   if line.startswith('INSTRUMENTATION_STATUS_CODE:'):
    code=int(line.split(':',1)[1]);passed+=named and code==0;skipped+=named and code in (-3,-4);named=False
  assert passed+skipped==int(re.search(r'OK \((\d+) tests\)',text)[1]);return {'passed':passed,'skipped':skipped}
 junit=[]
 for file in (ROOT/'apps/android/app/build/test-results/testDebugUnitTest').glob('TEST-*.xml'):
  element=ET.parse(file).getroot();assert element.attrib['errors']==element.attrib['failures']=='0';junit.append(int(element.attrib['tests']))
 for variant in ('debug','connected'):
  assert not any(i.get('severity') in ('Error','Fatal') for i in ET.parse(ROOT/f'apps/android/app/build/reports/lint-results-{variant}.xml').getroot())
 assert 'Tests  8 passed' in (work/'rules.log').read_text()
 result={'schema':'sonri.hybrid.executed-acceptance.v1','base_pr6_commit':'c6ca0ea49a078d13d3f49574fc498ca765368d1a',
  'kotlin_tests_passed':sum(junit),'rules_tests_passed':8,'primary_connected_apk_software':tests(work/'primary-offline/software-instrumentation.log'),
  'actual_rfdetr_android':tests(work/'primary-offline/pretrained-instrumentation.log'),'actual_local_services_tests':connected['tests_passed'],
  'lint_debug':'PASS','lint_connected':'PASS','primary_apk_static':apk,'primary_apk_host':host,'rfdetr_emulator':pretrained,
  'connected_local_execution':connected,'hosted_firebase':False,'cloudflare_hosted':False,'app_distribution_invites_sent':False,
  'physical_devices_tested':0,'patient_data_sync_enabled':False,'model_redistribution_authorized':False,'clinical_use':'PROHIBITED',
  'limits':['One AOSP ARM64 emulator; two named Firebase client contexts, not two physical phones or full multidevice product UI acceptance.',
   'Owner has no approved separate Spark project. Google/email delivery, hosted sync/recovery, expired hosted credentials and exhausted provider quotas remain untested.',
   'Signed delivery uses ephemeral local TLS and a software arithmetic ONNX kernel, not a hosted dental model release.',
   'Random recovery-code design is not independently approved for patients; per-record professional key sharing and hardened owner-signed connected release remain gated.',
   'Account deletion is an explicit operator-purge request, not immediate user-facing completion. Model labels/independent clinical evaluation and original credential revocation remain unresolved.']}
 output=ROOT/'apps/android/evidence/hybrid-acceptance.v1.json';output.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:result[k] for k in ['kotlin_tests_passed','rules_tests_passed','primary_connected_apk_software','actual_rfdetr_android','actual_local_services_tests','hosted_firebase']}))
if __name__=='__main__':main()
