"""Read actual APK ZIP and merged manifest; no image/model inference claim."""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import xml.etree.ElementTree as ET
import zipfile

def verify(apk,manifest,connected=False):
    root=ET.fromstring(manifest.read_text());ns='{http://schemas.android.com/apk/res/android}'
    permissions={p.get(ns+'name') for p in root.findall('uses-permission')}
    assert not permissions.intersection({'android.permission.READ_EXTERNAL_STORAGE','android.permission.RECORD_AUDIO'})
    assert ('android.permission.INTERNET' in permissions)==connected
    assert ('android.permission.ACCESS_NETWORK_STATE' in permissions)==connected
    app=root.find('application');assert app.get(ns+'allowBackup')=='false' and app.get(ns+'usesCleartextTraffic')=='false'
    checks=[]
    with zipfile.ZipFile(apk) as z:
        names=z.namelist()
        assert 'assets/terminology.v1.json' in names and 'assets/research-fixture.png' in names
        model_manifest=json.loads(z.read('assets/model-manifest.v1.json'))
        audited=model_manifest['models'][0]
        assert audited['sha256']=='a73a2bb52bca024f98bcddc446fed57e4c3b1296558c6eddb6dc87f0d9c7f5e0'
        assert audited['bytes']==121573930 and not audited['bundled']
        assert audited['label_verification']=='UNVERIFIED' and audited['disease_mapping'] is None
        assert not any(n.endswith(('.onnx','.ort','.pt','.h5','.keystore','.jks')) for n in names)
        assert not any('software-arithmetic' in n or 'rfdetr-reference' in n for n in names)
        for name in names:
            if not name.startswith('lib/') or not name.endswith('.so'):continue
            data=z.read(name);assert data[:4]==b'\x7fELF' and data[4]==2
            phoff=struct.unpack_from('<Q',data,32)[0];size,count=struct.unpack_from('<HH',data,54)
            aligns=[struct.unpack_from('<Q',data,phoff+i*size+48)[0] for i in range(count) if struct.unpack_from('<I',data,phoff+i*size)[0]==1]
            checks.append({'library':name,'elf_load_alignment':min(aligns),'supports_16k_elf_alignment':min(aligns)>=16384})
        assert checks and all(c['supports_16k_elf_alignment'] for c in checks),'NATIVE_LIBRARY_16K_ALIGNMENT_FAILED'
    return {'schema_version':'sonri.android-apk-static.v1','apk':apk.name,'sha256':hashlib.sha256(apk.read_bytes()).hexdigest(),
        'bytes':apk.stat().st_size,'permissions':sorted(permissions),'internet_permission':connected,'pretrained_model_bundled':False,
        'native_libraries':checks,'clinical_use':'PROHIBITED','scope':'ACTUAL_APK_STATIC_INSPECTION_NOT_DEVICE_PERFORMANCE'}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--apk',type=Path,required=True);p.add_argument('--manifest',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--connected',action='store_true')
    a=p.parse_args();report=verify(a.apk,a.manifest,a.connected);a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'sha256':report['sha256'],'bytes':report['bytes'],'internet_permission':a.connected,'pretrained_model_bundled':False,'native_libraries':len(report['native_libraries'])}))
if __name__=='__main__':main()
