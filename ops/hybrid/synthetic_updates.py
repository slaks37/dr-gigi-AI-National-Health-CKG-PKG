"""Generate ephemeral test signing/TLS keys outside Git; serve synthetic update fixtures only."""
import argparse,base64,hashlib,http.server,json,ssl,subprocess
from datetime import datetime,timedelta,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def run(*args):return subprocess.run(args,check=True,capture_output=True).stdout
def prepare(out,assets):
    if out.resolve().is_relative_to(ROOT):raise ValueError('EPHEMERAL_TEST_KEYS_MUST_STAY_OUTSIDE_REPOSITORY')
    out.mkdir(parents=True,exist_ok=True);out.chmod(0o700);assets.mkdir(parents=True,exist_ok=True)
    run('openssl','ecparam','-name','prime256v1','-genkey','-noout','-out',str(out/'signing.pem'))
    public=run('openssl','pkey','-in',str(out/'signing.pem'),'-pubout','-outform','DER')
    (assets/'public-key.txt').write_text(base64.b64encode(public).decode())
    run('openssl','req','-x509','-newkey','rsa:2048','-nodes','-days','2','-subj','/CN=SONRI synthetic local TLS only',
        '-addext','subjectAltName=IP:10.0.2.2,IP:127.0.0.1,DNS:localhost','-keyout',str(out/'tls.pem'),'-out',str(out/'certificate.pem'))
    (assets/'certificate.pem').write_bytes((out/'certificate.pem').read_bytes())
    artifact=(ROOT/'apps/android/app/src/androidTest/assets/software-arithmetic.onnx.bin').read_bytes()
    (out/'software.bin').write_bytes(artifact)
    for stage in (1,2):
        models=[{'version':v,'path':('/software%d.bin'%v) if v<3 else ('/corrupted.bin' if v==3 else '/interrupted.bin'),
            'bytes':len(artifact),'sha256':hashlib.sha256(artifact).hexdigest(),'contract':'SOFTWARE_KERNEL_TEST'} for v in range(stage,5)]
        payload=json.dumps({'schema':1,'sequence':stage,'expiresAt':(datetime.now(timezone.utc)+timedelta(days=7)).isoformat(),
            'minimumSafeVersion':stage,'models':models},separators=(',',':')).encode()
        (out/'payload.json').write_bytes(payload)
        signature=run('openssl','dgst','-sha256','-sign',str(out/'signing.pem'),str(out/'payload.json'))
        (out/f'manifest-{stage}.json').write_text(json.dumps({'payload':base64.b64encode(payload).decode(),'signature':base64.b64encode(signature).decode()}))
    for name in ('signing.pem','tls.pem'): (out/name).chmod(0o600)
    print('Ephemeral synthetic TLS/update fixtures generated; no production trust authority created.')
def serve(out,port):
    class Handler(http.server.BaseHTTPRequestHandler):
        stage=1
        def log_message(self,*args):pass
        def do_GET(self):
            if self.path=='/revoke':Handler.stage=2;content=b'ok'
            elif self.path=='/reset':Handler.stage=1;content=b'ok'
            elif self.path=='/manifest.json':content=(out/f'manifest-{Handler.stage}.json').read_bytes()
            elif self.path in ('/software1.bin','/software2.bin'):content=(out/'software.bin').read_bytes()
            elif self.path=='/corrupted.bin':content=b'0'*(out/'software.bin').stat().st_size
            elif self.path=='/interrupted.bin':content=b'interrupted'
            else:self.send_error(404);return
            self.send_response(200);self.send_header('Content-Length',str(len(content)));self.end_headers();self.wfile.write(content)
    server=http.server.ThreadingHTTPServer(('127.0.0.1',port),Handler)
    context=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER);context.load_cert_chain(out/'certificate.pem',out/'tls.pem')
    server.socket=context.wrap_socket(server.socket,server_side=True);server.serve_forever()
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('mode',choices=['prepare','serve']);p.add_argument('--out',type=Path,required=True);p.add_argument('--assets',type=Path);p.add_argument('--port',type=int,default=8443)
    a=p.parse_args();prepare(a.out,a.assets) if a.mode=='prepare' else serve(a.out,a.port)
