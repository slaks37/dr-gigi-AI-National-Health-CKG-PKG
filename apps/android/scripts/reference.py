"""Actual desktop CPU baseline + deterministic nonpatient fixtures. Never ships weights."""
import argparse
from collections import Counter
import gzip
import hashlib
import io
import json
from pathlib import Path
import platform
import resource
import sys
import time

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'services/inference'))
from smoke_pretrained import synthetic_fixture
from sonri_inference.adapters import OnnxAdapter
from sonri_inference.registry import ModelSpec
import numpy as np
import onnx
from onnx import helper, TensorProto, numpy_helper
import onnxruntime as ort
from PIL import Image

SHA = 'a73a2bb52bca024f98bcddc446fed57e4c3b1296558c6eddb6dc87f0d9c7f5e0'

def tensor(image):
    rgb = np.asarray(image, dtype=np.float32)
    y = np.maximum(0, (np.arange(704, dtype=np.float32) + .5) * image.height / 704 - .5)
    x = np.maximum(0, (np.arange(704, dtype=np.float32) + .5) * image.width / 704 - .5)
    y0, x0 = y.astype(np.int32), x.astype(np.int32)
    y1, x1 = np.minimum(y0 + 1, image.height - 1), np.minimum(x0 + 1, image.width - 1)
    fy, fx = (y-y0)[:,None,None], (x-x0)[None,:,None]
    resized = ((rgb[y0[:,None], x0[None,:]]*(1-fx) + rgb[y0[:,None], x1[None,:]]*fx)*(1-fy)
               + (rgb[y1[:,None], x0[None,:]]*(1-fx) + rgb[y1[:,None], x1[None,:]]*fx)*fy)
    return ((resized/255 - np.array([.485,.456,.406],np.float32))/np.array([.229,.224,.225],np.float32)).transpose(2,0,1)[None].astype(np.float32)

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--checkpoint',type=Path,required=True)
    p.add_argument('--evidence-dir',type=Path,required=True)
    p.add_argument('--permission-reference',required=True)
    a=p.parse_args()
    if len(a.permission_reference)<8 or a.checkpoint.stat().st_size!=121573930 or hashlib.sha256(a.checkpoint.read_bytes()).hexdigest()!=SHA:
        raise ValueError('AUDITED_MODEL_AND_PERMISSION_REFERENCE_REQUIRED')
    if a.evidence_dir.resolve().is_relative_to(ROOT):raise ValueError('PRIVATE_EXECUTION_EVIDENCE_OUTSIDE_GIT_REQUIRED')
    main_assets=ROOT/'apps/android/app/src/main/assets'
    test_assets=ROOT/'apps/android/app/src/androidTest/assets'
    test_assets.mkdir(parents=True,exist_ok=True);a.evidence_dir.mkdir(parents=True,exist_ok=True)
    fixture=synthetic_fixture();(main_assets/'research-fixture.png').write_bytes(fixture)
    # A second non-square fixture actually exercises half-pixel resize and geometry.
    y,x=np.mgrid[:123,:315]
    rgb=np.stack(((x*3+y*7)%256,(x*11+y*5)%256,(x*2+y*13)%256),axis=-1).astype(np.uint8)
    image=Image.fromarray(rgb);stream=io.BytesIO();image.save(stream,format='PNG')
    (test_assets/'resize-fixture.png').write_bytes(stream.getvalue())
    # Own geometric JPEG: orientation 6 must rotate clockwise without a disk cache.
    oriented=Image.new('RGB',(120,80))
    oriented.paste((255,0,0),(0,0,60,40));oriented.paste((0,255,0),(60,0,120,40))
    oriented.paste((0,0,255),(0,40,60,80));oriented.paste((255,255,0),(60,40,120,80))
    exif=Image.Exif();exif[274]=6
    oriented.save(test_assets/'orientation-6.jpg',quality=95,subsampling=0,exif=exif)
    pre=tensor(image)
    with (test_assets/'resize-reference.f32.fixture').open('wb') as file:
        with gzip.GzipFile(fileobj=file,mode='wb',mtime=0) as z:z.write(pre.astype('<f4').tobytes())
    # Software-only native arithmetic test, deliberately incompatible with the model import hash/contract.
    graph=helper.make_graph([helper.make_node('Mul',['x','two'],['product']),helper.make_node('Add',['product','one'],['y'])],
        'SONRI_SOFTWARE_KERNEL_TEST_NOT_DENTAL_AI',[helper.make_tensor_value_info('x',TensorProto.FLOAT,[1,3])],
        [helper.make_tensor_value_info('y',TensorProto.FLOAT,[1,3])],
        [numpy_helper.from_array(np.array(2,np.float32),'two'),numpy_helper.from_array(np.array(1,np.float32),'one')])
    arithmetic=helper.make_model(graph,opset_imports=[helper.make_opsetid('',17)]);arithmetic.ir_version=9
    (test_assets/'software-arithmetic.onnx.bin').write_bytes(arithmetic.SerializeToString())
    model=onnx.load(str(a.checkpoint),load_external_data=False)
    if any(t.external_data for t in model.graph.initializer):raise ValueError('EXTERNAL_MODEL_DATA_UNSUPPORTED')
    onnx.checker.check_model(model)
    weight_bytes=sum(numpy_helper.to_array(t).nbytes for t in model.graph.initializer)
    spec=ModelSpec(id='comparative-rfdetr',modality='intraoral',adapter='onnx-detector',checkpoint=str(a.checkpoint),
        input_size=704,output_format='rfdetr-cxcywh-logits',class_names={str(i):f'RAW_CLASS_{i}' for i in range(5)})
    started=time.perf_counter();adapter=OnnxAdapter(spec);load_ms=(time.perf_counter()-started)*1000
    goldens=[]
    for name,content in [('research-fixture.png',fixture),('resize-fixture.png',stream.getvalue())]:
        im=Image.open(io.BytesIO(content)).convert('RGB');input_tensor=tensor(im)
        start=time.perf_counter();boxes,logits=adapter.session.run(None,{'input':input_tensor});latency=(time.perf_counter()-start)*1000
        # Reuse the existing adapter's actual decoder as an independent Kotlin port reference.
        findings=adapter.infer(im)
        goldens.append({'fixture':name,'fixture_sha256':hashlib.sha256(content).hexdigest(),
            'boxes':boxes.flatten().tolist(),'logits':logits.flatten().tolist(),'findings':findings,
            'desktop_inference_ms':latency})
    reference={'schema_version':'sonri.android-equivalence-reference.v1','model_sha256':SHA,'data_kind':'SYNTHETIC_SOFTWARE_FIXTURE',
        'clinical_use':'PROHIBITED','label_verification':'UNVERIFIED','runtime':ort.__version__,'fixtures':goldens,
        'tolerances':{'preprocess_max_abs':2e-6,'boxes_max_abs':1e-4,'logits_max_abs':1e-3},
        'reference_adapter_sha256':hashlib.sha256((ROOT/'services/inference/sonri_inference/adapters.py').read_bytes()).hexdigest()}
    (test_assets/'rfdetr-reference.json').write_text(json.dumps(reference,indent=2)+'\n')
    audit={'schema_version':'sonri.android-model-audit.v1','model_sha256':SHA,'model_bytes':a.checkpoint.stat().st_size,
        'ir_version':model.ir_version,'opsets':{o.domain or 'ai.onnx':o.version for o in model.opset_import},
        'operators':dict(sorted(Counter((n.domain or 'ai.onnx')+':'+n.op_type for n in model.graph.node).items())),
        'initializer_bytes':weight_bytes,'external_weights':False,'desktop_onnx_runtime':ort.__version__,
        'desktop_platform':platform.platform(),'desktop_load_ms':load_ms,'desktop_process_peak_rss_bytes':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*(1 if sys.platform=='darwin' else 1024),
        'inputs':[{'name':i.name,'shape':i.shape,'type':i.type} for i in adapter.session.get_inputs()],
        'outputs':[{'name':o.name,'shape':o.shape,'type':o.type} for o in adapter.session.get_outputs()],
        'baseline_optimization':'ORT_ALL_OPT_CPU_2_THREADS','fp16':False,'quantization':False,'model_modified':False,
        'permission_basis_reference':a.permission_reference,'android_redistribution_rights':'NOT_INDEPENDENTLY_VERIFIED',
        'packaged_in_apk':False,'physical_phone_tested':False,'clinical_use':'PROHIBITED',
        'limitations':['Desktop peak RSS includes ONNX inspection, weights and reference generation; it is not an Android memory benchmark.',
            'Prior owner-local research approval is not proof of unrestricted Android redistribution rights.',
            'No disease class contract or clinical accuracy is established.']}
    (a.evidence_dir/'desktop-model-audit.json').write_text(json.dumps(audit,indent=2)+'\n')
    (a.evidence_dir/'desktop-reference.json').write_text(json.dumps(reference,indent=2)+'\n')
    print(json.dumps({'status':'ACTUAL_DESKTOP_REFERENCE_COMPLETE','fixtures':len(goldens),'findings':[len(f['findings']) for f in goldens],
        'model_sha256':SHA,'load_ms':load_ms,'clinical_validation':False,'android_inference_established':False}))

if __name__=='__main__':main()
