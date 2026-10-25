"""Read bounded public ZIP members with HTTP ranges and ZIP CRC verification.

Archive-level MD5 remains unverified unless the full file is downloaded; each
selected member receives its own SHA-256 in the evaluation manifest.
"""
import io,struct,zipfile,zlib,urllib.request,time
class RemoteZip:
 def __init__(self,url,size):
  self.url=url; self.size=size
  tail=self.read(size-65536,size-1); pos=tail.rfind(b'PK\x05\x06')
  _,disk,cd_disk,n_disk,n,cd_size,cd_offset,comment=struct.unpack('<4s4H2LH',tail[pos:pos+22])
  assert not disk and not cd_disk and n_disk==n
  central=self.read(cd_offset,cd_offset+cd_size-1)
  eocd=struct.pack('<4s4H2LH',b'PK\x05\x06',0,0,n,n,cd_size,0,0)
  self.members={x.filename:x for x in zipfile.ZipFile(io.BytesIO(central+eocd)).infolist()}
 def read(self,start,end):
  for retry in range(4):
   req=urllib.request.Request(self.url,headers={'Range':f'bytes={start}-{end}','User-Agent':'SONRI-research-provenance/1.0'})
   try:
    with urllib.request.urlopen(req,timeout=60) as r:
     assert r.status==206 and r.headers.get('Content-Range','').startswith(f'bytes {start}-{end}/')
     b=r.read(); assert len(b)==end-start+1; return b
   except Exception:
    if retry==3:raise
    time.sleep(2**retry)
 def extract(self,name):
  x=self.members[name]; h=self.read(x.header_offset,x.header_offset+29)
  sig,version,flags,method,t,d,crc,cs,us,fn,extra=struct.unpack('<4s5H3L2H',h);assert sig==b'PK\x03\x04'
  offset=x.header_offset+30+fn+extra
  b=self.read(offset,offset+x.compress_size-1)
  data=zlib.decompress(b,-15) if x.compress_type==8 else b
  assert len(data)==x.file_size and zlib.crc32(data)&0xffffffff==x.CRC
  return data
