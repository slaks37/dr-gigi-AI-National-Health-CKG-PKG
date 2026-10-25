"""Normalize completed synthetic-only execution evidence, never model weights or device IDs."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]

def read(path):return json.loads(path.read_text())
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--execution',type=Path,required=True);p.add_argument('--desktop',type=Path,required=True)
    p.add_argument('--apk-static',type=Path,required=True);p.add_argument('--build-log',type=Path,required=True)
    p.add_argument('--output',type=Path,default=ROOT/'evidence');a=p.parse_args()
    host=read(a.execution/'host-execution.json');model=read(a.execution/'pretrained-device-evidence.json');apk=read(a.apk_static)
    assert host['software_instrumentation']=='PASS' and host['pretrained_inference']=='ACTUAL_PRETRAINED_ANDROID_EXECUTION'
    assert host['hardware_scope']==model['hardware_scope']=='ANDROID_EMULATOR' and not model['physical_phone_tested']
    assert host['apk_sha256']==apk['sha256']==digest(ROOT/'app/build/outputs/apk/debug/app-debug.apk')
    assert host['instrumentation_apk_sha256']==digest(ROOT/'app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk')
    assert all(digest(ROOT/name)==sha for name,sha in host['tested_source_sha256'].items()),'TESTED_SOURCE_DRIFT'
    assert 'BUILD SUCCESSFUL' in a.build_log.read_text()
    junit=ET.parse(ROOT/'app/build/test-results/testDebugUnitTest/TEST-id.sonri.offline.ResearchCoreTest.xml').getroot()
    assert int(junit.attrib['failures'])==int(junit.attrib['errors'])==0
    lint=ET.parse(ROOT/'app/build/reports/lint-results-debug.xml').getroot()
    severities=Counter(issue.attrib['severity'] for issue in lint)
    assert severities['Error']==severities['Fatal']==0
    software=(a.execution/'software-instrumentation.log').read_text()
    pretrained=(a.execution/'pretrained-instrumentation.log').read_text()
    def instrumentation(log):
        assert 'FAILURES!!!' not in log and 'Process crashed' not in log and re.search(r'OK \(\d+ tests\)',log)
        passed=skipped=0;has_test=False
        for line in log.splitlines():
            if line.startswith('INSTRUMENTATION_STATUS: test='):has_test=True
            if line.startswith('INSTRUMENTATION_STATUS_CODE:'):
                code=int(line.split(':',1)[1])
                if has_test and code==0:passed+=1
                if has_test and code in (-3,-4):skipped+=1
                has_test=False
        assert passed+skipped==int(re.search(r'OK \((\d+) tests\)',log)[1]),'INSTRUMENTATION_COUNT_MISMATCH'
        return {'passed':passed,'skipped':skipped}
    scope={'schema_version':'sonri.android-executed-software.v1','recorded_from_completed_execution':True,
        'executed_at_utc':host['executed_at_utc'],'clinical_use':'PROHIBITED','physical_phone_tested':False,
        'kotlin_tests':{'passed':int(junit.attrib['tests']),'failures':0,'errors':0},
        'android_lint':{'errors':0,'severity_counts':dict(severities)},'debug_build':'PASS','unsigned_release_build':'PASS',
        'software_instrumentation':instrumentation(software),'private_pretrained_instrumentation':instrumentation(pretrained),
        'logs_sha256':{name:digest(path) for name,path in {'gradle':a.build_log,'software':a.execution/'software-instrumentation.log','pretrained':a.execution/'pretrained-instrumentation.log'}.items()},
        'limits':['Synthetic software evidence only, not an independent dental dataset benchmark.',
            'No physical phone, sustained battery/thermal or memory-pressure benchmark.',
            'System credential prompt, real camera and system picker interaction need manual hardware acceptance.',
            'No model artifact redistribution approval or clinical validation established.']}
    a.output.mkdir(parents=True,exist_ok=True)
    for name,data in {'software-tests.v1.json':scope,'android-emulator.v1.json':{'host':host,'pretrained':model},
        'model-graph-audit.v1.json':read(a.desktop/'desktop-model-audit.json'),'apk-static.v1.json':apk}.items():
        (a.output/name).write_text(json.dumps(data,indent=2)+'\n')
    print(json.dumps({'kotlin':scope['kotlin_tests'],'software':scope['software_instrumentation'],
        'pretrained':scope['private_pretrained_instrumentation'],'hardware_scope':'ANDROID_EMULATOR','clinical_validation':False}))

if __name__=='__main__':main()
