"""Actual Android tests against local Auth/Firestore and HTTPS fixtures, emulator only."""
import argparse,hashlib,json,subprocess,time
from datetime import datetime,timezone
from pathlib import Path
from emulator_unlock import unlock
PACKAGE='id.sonri.offline.research'
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--adb',default='adb');p.add_argument('--serial',required=True);p.add_argument('--apk',type=Path,required=True);p.add_argument('--test-apk',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True)
 base=[a.adb,'-s',a.serial]
 def adb(*cmd,check=True):
  r=subprocess.run(base+list(cmd),capture_output=True,text=True,timeout=180)
  if check and r.returncode:raise RuntimeError('EMULATOR_COMMAND_FAILED_NO_PRIVATE_OUTPUT_EMITTED')
  return r.stdout
 if adb('shell','getprop','ro.kernel.qemu').strip()!='1':raise ValueError('DEDICATED_ANDROID_EMULATOR_REQUIRED')
 root=Path(__file__).resolve().parents[1]
 def sources():return {str(x.relative_to(root)):hashlib.sha256(x.read_bytes()).hexdigest() for x in sorted((root/'app/src').rglob('*')) if x.is_file() and '/assets/generated/' not in x.as_posix()}
 before=sources();sha=hashlib.sha256(a.apk.read_bytes()).hexdigest();test_sha=hashlib.sha256(a.test_apk.read_bytes()).hexdigest()
 adb('shell','settings','put','global','airplane_mode_on','0');adb('shell','svc','wifi','enable');adb('shell','svc','data','enable')
 pin=adb('shell','locksettings','set-pin','135790',check=False)
 if 'set to' not in pin.lower():adb('shell','locksettings','verify','--old','135790')
 unlock(adb)
 adb('install','-r','-t',str(a.apk));adb('install','-r','-t',str(a.test_apk))
 output=adb('shell','am','instrument','-w','-r','-e','class','id.sonri.offline.ConnectedFirebaseTest,id.sonri.offline.SignedDeliveryTest',PACKAGE+'.test/androidx.test.runner.AndroidJUnitRunner')
 (a.output/'instrumentation.log').write_text(output)
 if 'OK (2 tests)' not in output or 'FAILURES!!!' in output:raise RuntimeError('CONNECTED_ANDROID_ACCEPTANCE_FAILED_SEE_SYNTHETIC_LOG')
 if before!=sources() or hashlib.sha256(a.apk.read_bytes()).hexdigest()!=sha:raise RuntimeError('TESTED_SOURCE_OR_APK_DRIFT')
 report={'schema':'sonri.hybrid.local-acceptance.v1','executed_at_utc':datetime.now(timezone.utc).isoformat(),'scope':'ONE_ANDROID_EMULATOR_TWO_NAMED_FIREBASE_CLIENTS_AND_LOCAL_HTTPS_ONLY','tests_passed':2,'hosted_firebase':False,'cloudflare_hosted':False,'physical_devices_tested':0,'apk_sha256':sha,'instrumentation_apk_sha256':test_sha,'stable_source_sha256':before,'instrumentation_log_sha256':hashlib.sha256(output.encode()).hexdigest(),'clinical_use':'PROHIBITED','patient_data_sync':False,'actual_dental_model_update':False,'details':['Actual email registration, emulator OOB verification, login, profiles, independent-client encrypted restore, offline denial, idempotency, stale conflict, reviewed-head preservation, other-user denial, password recovery request, deletion request and sign-out.','Actual local HTTPS signature/SHA checking, two synthetic ONNX activations, corrupt/truncated rejection, atomic recovery, compatible rollback, airplane-mode native arithmetic and security-floor revocation.']}
 (a.output/'execution.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:report[k] for k in ['scope','tests_passed','hosted_firebase','physical_devices_tested']}))
if __name__=='__main__':main()
