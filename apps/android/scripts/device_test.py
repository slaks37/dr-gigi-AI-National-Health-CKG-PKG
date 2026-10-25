"""Install and instrument this research APK; synthetic assets only, no private weights uploaded to CI."""
import argparse
from datetime import datetime,timezone
import hashlib
import json
from pathlib import Path
import subprocess
import time
from emulator_unlock import unlock

PACKAGE='id.sonri.offline.research'
MODEL_SHA='a73a2bb52bca024f98bcddc446fed57e4c3b1296558c6eddb6dc87f0d9c7f5e0'
MODEL_BYTES=121573930

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--adb',default='adb');parser.add_argument('--serial',required=True)
    parser.add_argument('--apk',type=Path,required=True);parser.add_argument('--test-apk',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True);parser.add_argument('--setup-emulator',action='store_true')
    parser.add_argument('--physical-approved-synthetic-only',action='store_true')
    parser.add_argument('--pretrained',type=Path);parser.add_argument('--permission-reference');parser.add_argument('--iterations',type=int,default=5)
    args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
    source_root=Path(__file__).resolve().parents[1]
    def sources():
        return {str(p.relative_to(source_root)):hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted((source_root/'app/src').rglob('*')) if p.is_file()}
    source_before=sources()
    apk_hash=hashlib.sha256(args.apk.read_bytes()).hexdigest()
    test_apk_hash=hashlib.sha256(args.test_apk.read_bytes()).hexdigest()
    prefix=[args.adb,'-s',args.serial]
    def adb(*parts,timeout=180,stdin=None,allow_failure=False):
        result=subprocess.run([*prefix,*parts],stdin=stdin,capture_output=True,timeout=timeout)
        if result.returncode and not allow_failure:
            (args.output/'adb-failure.log').write_bytes(result.stdout+b'\n'+result.stderr)
            raise RuntimeError('ADB_COMMAND_FAILED_OUTPUT_RETAINED_PRIVATELY')
        return result.stdout.decode(errors='replace')
    qemu=adb('shell','getprop','ro.kernel.qemu').strip()=='1'
    if not qemu and not args.physical_approved_synthetic_only:raise ValueError('EXPLICIT_PHYSICAL_DEVICE_SYNTHETIC_APPROVAL_REQUIRED')
    if args.setup_emulator and not qemu:raise ValueError('PHYSICAL_SETTINGS_MUTATION_FORBIDDEN')
    for _ in range(120):
        if adb('shell','getprop','sys.boot_completed').strip()=='1':break
        time.sleep(1)
    else:raise RuntimeError('ANDROID_BOOT_NOT_COMPLETE')
    if args.setup_emulator:
        adb('shell','settings','put','global','airplane_mode_on','1')
        adb('shell','svc','wifi','disable');adb('shell','svc','data','disable')
        adb('shell','input','keyevent','82')
        pin=adb('shell','locksettings','set-pin','135790',allow_failure=True)
        if 'set to' not in pin.lower():
            pin=adb('shell','locksettings','set-pin','--old','135790','135790',allow_failure=True)
        if 'set to' not in pin.lower():raise RuntimeError('ISOLATED_EMULATOR_SCREEN_LOCK_SETUP_FAILED')
        unlock(adb)
    if adb('shell','settings','get','global','airplane_mode_on').strip()!='1':raise ValueError('USER_CONFIRMED_AIRPLANE_MODE_REQUIRED')
    adb('install','-r','-t',str(args.apk));adb('install','-r','-t',str(args.test_apk))
    adb('shell','am','force-stop',PACKAGE)
    start=adb('shell','am','start','-W','-n',PACKAGE+'/id.sonri.offline.MainActivity')
    startup={}
    for line in start.splitlines():
        key,sep,value=line.partition(':')
        if sep and key.strip() in ('ThisTime','TotalTime','WaitTime'):
            startup[key.strip()+'_ms']=int(value.strip())
    if not startup or 'Status: ok' not in start:raise RuntimeError('ACTUAL_ANDROID_STARTUP_FAILED')
    adb('shell','am','force-stop',PACKAGE)
    runner=PACKAGE+'.test/androidx.test.runner.AndroidJUnitRunner'
    base=adb('shell','am','instrument','-w','-r',runner,timeout=360)
    (args.output/'software-instrumentation.log').write_text(base)
    if 'FAILURES!!!' in base or 'INSTRUMENTATION_FAILED' in base or 'Process crashed' in base or 'OK (' not in base:
        raise RuntimeError('ANDROID_SOFTWARE_INSTRUMENTATION_FAILED')
    report={'schema_version':'sonri.android-host-execution.v1','executed_at_utc':datetime.now(timezone.utc).isoformat(),
        'hardware_scope':'ANDROID_EMULATOR' if qemu else 'PHYSICAL_ANDROID_DEVICE','physical_phone_tested':not qemu,
        'device_identifiers_emitted':False,'apk_sha256':apk_hash,'apk_bytes':args.apk.stat().st_size,
        'instrumentation_apk_sha256':test_apk_hash,
        'software_instrumentation':'PASS','emulator_radio_settings_changed':args.setup_emulator,'airplane_mode_observed':True,
        'cold_process_activity_startup':startup,
        'pretrained_inference':'NOT_REQUESTED_PRIVATE_CHECKPOINT_ABSENT','clinical_use':'PROHIBITED','clinical_validation':False}
    if args.pretrained:
        if not args.permission_reference or len(args.permission_reference)<8 or hashlib.sha256(args.pretrained.read_bytes()).hexdigest()!=MODEL_SHA:raise ValueError('AUDITED_CHECKPOINT_AND_RESEARCH_PERMISSION_REFERENCE_REQUIRED')
        try:
            with args.pretrained.open('rb') as source:
                adb('exec-in','run-as',PACKAGE,'dd','of=no_backup/android-test-rfdetr.onnx','bs=1048576',stdin=source)
            # exec-in may return before the remote pipe consumer has flushed all bytes.
            # Admit the actual model only after remote size AND full SHA-256 agree.
            for _ in range(60):
                transferred=adb('shell','run-as',PACKAGE,'stat','-c','%s','no_backup/android-test-rfdetr.onnx').strip()
                if transferred==str(MODEL_BYTES):break
                time.sleep(.5)
            else:raise RuntimeError('REMOTE_MODEL_TRANSFER_INCOMPLETE')
            remote_hash=adb('shell','run-as',PACKAGE,'sha256sum','no_backup/android-test-rfdetr.onnx').split()[0]
            if remote_hash!=MODEL_SHA:raise RuntimeError('REMOTE_MODEL_TRANSFER_HASH_MISMATCH')
            result=adb('shell','am','instrument','-w','-r','-e','class','id.sonri.offline.PretrainedEquivalenceTest',
                '-e','pretrained','true','-e','permissionReference',args.permission_reference,'-e','iterations',str(args.iterations),runner,timeout=1200)
            (args.output/'pretrained-instrumentation.log').write_text(result)
            if 'FAILURES!!!' in result or 'INSTRUMENTATION_FAILED' in result or 'Process crashed' in result or 'OK (' not in result:raise RuntimeError('PRETRAINED_ANDROID_INFERENCE_FAILED')
            measured=json.loads(adb('exec-out','run-as',PACKAGE,'cat','files/synthetic-benchmark-evidence.json'))
            if measured['model_sha256']!=MODEL_SHA or measured['physical_phone_tested']!= (not qemu):raise RuntimeError('DEVICE_EVIDENCE_SCOPE_MISMATCH')
            (args.output/'pretrained-device-evidence.json').write_text(json.dumps(measured,indent=2)+'\n')
            report['pretrained_inference']='ACTUAL_PRETRAINED_ANDROID_EXECUTION'
        finally:
            adb('shell','run-as',PACKAGE,'rm','-f','no_backup/android-test-rfdetr.onnx')
    if sources()!=source_before or hashlib.sha256(args.apk.read_bytes()).hexdigest()!=apk_hash or hashlib.sha256(args.test_apk.read_bytes()).hexdigest()!=test_apk_hash:
        raise RuntimeError('SOURCE_OR_APK_CHANGED_DURING_TEST_ABORT_EVIDENCE')
    report['tested_source_sha256']=source_before
    report['harness_sha256']=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    (args.output/'host-execution.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:report[k] for k in ['hardware_scope','software_instrumentation','pretrained_inference','physical_phone_tested','clinical_validation']}))

if __name__=='__main__':main()
