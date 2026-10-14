import 'server-only';
import sharp from 'sharp';
import { decodeHeif } from './heif';
import { createHash } from 'node:crypto';
import { ImageQuality } from '../types/schema';
export interface PreparedImage { quality:ImageQuality; normalized:Uint8Array|null; perceptual_hash:string|null }
export function detectMime(bytes:Uint8Array):string|null {
 const b=Buffer.from(bytes);
 if(b[0]===0xff&&b[1]===0xd8&&b[2]===0xff)return 'image/jpeg';
 if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
 if(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP')return 'image/webp';
 if(b.toString('ascii',4,8)==='ftyp'&&/heic|heix|hevc|hevx|mif1|msf1/.test(b.toString('ascii',8,40)))return 'image/heif';
 return null;
}
export async function validateImage(input:{data:string;mime_type:string},index:number):Promise<PreparedImage> {
 const q:ImageQuality={image_index:index,status:'CORRUPT_IMAGE',width:null,height:null,sha256:null,brightness:null,blur_variance:null,oral_region_status:'NOT_ASSESSED',reasons:[],duplicate_of:null,quality_gate_version:'engineering-heuristic-1',clinically_validated:false};
 const bytes=Buffer.from(input.data,'base64');
 if(bytes.length===0||bytes.length>3_000_000){q.reasons=['Ukuran gambar tidak didukung.'];return{quality:q,normalized:null,perceptual_hash:null};}
 const mime=detectMime(bytes);
 if(!mime||(mime!==input.mime_type&&!(mime==='image/heif'&&input.mime_type==='image/heic'))){q.status='UNSUPPORTED_FORMAT';q.reasons=['MIME dan format berkas tidak cocok.'];return{quality:q,normalized:null,perceptual_hash:null};}
 q.sha256=createHash('sha256').update(bytes).digest('hex');
 try{
  let normalized:Buffer;
  if(mime==='image/heif'){
   const decoded=await decodeHeif(bytes);
   normalized=await sharp(decoded.pixels,{raw:{width:decoded.width,height:decoded.height,channels:4},limitInputPixels:12_000_000}).resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).jpeg({quality:85}).timeout({seconds:10}).toBuffer();
  }else{
   const metadata=await sharp(bytes,{limitInputPixels:40_000_000,failOn:'error'}).metadata();
   if(!metadata.width||!metadata.height)throw new Error('No dimensions');
   normalized=await sharp(bytes,{limitInputPixels:40_000_000,failOn:'error'}).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).jpeg({quality:85}).timeout({seconds:10}).toBuffer();
  }
  const nm=await sharp(normalized).metadata();q.width=nm.width??null;q.height=nm.height??null;
  const {data,info}=await sharp(normalized).resize({width:256,height:256,fit:'inside'}).greyscale().raw().toBuffer({resolveWithObject:true});
  let total=0,lap=0,lap2=0,n=0;for(const v of data)total+=v;q.brightness=total/data.length;
  for(let y=1;y<info.height-1;y++)for(let x=1;x<info.width-1;x++){const i=y*info.width+x;const v=4*data[i]-data[i-1]-data[i+1]-data[i-info.width]-data[i+info.width];lap+=v;lap2+=v*v;n++;}
  q.blur_variance=n?Math.max(0,lap2/n-(lap/n)**2):0;
  const tiny=await sharp(normalized).resize(9,8,{fit:'fill'}).greyscale().raw().toBuffer();let hash=BigInt(0);
  for(let y=0;y<8;y++)for(let x=0;x<8;x++)hash=(hash<<BigInt(1))|BigInt(tiny[y*9+x]>tiny[y*9+x+1]?1:0);
  const ph=hash.toString(16).padStart(16,'0');
  // These thresholds are engineering heuristics, never calibrated clinical performance.
  if(Math.min(q.width??0,q.height??0)<320||q.brightness<25||q.brightness>235||(q.blur_variance??0)<20){q.status='LOW_QUALITY';q.reasons=['Resolusi, pencahayaan, atau ketajaman mungkin tidak memadai. Ambil ulang foto.'];}
  else {q.status='REVIEW_REQUIRED';q.reasons=['Berkas dapat dibaca; keberadaan struktur oral belum dinilai oleh detector tervalidasi.'];}
  return {quality:q,normalized,perceptual_hash:ph};
 }catch{
  q.status=mime==='image/heif'?'UNSUPPORTED_FORMAT':'CORRUPT_IMAGE';q.reasons=[mime==='image/heif'?'Decoder HEIC/HEIF tidak tersedia atau berkas tidak dapat dibaca. Konversi secara lokal ke JPEG/PNG.':'Gambar rusak atau tidak dapat didekode.'];
  return{quality:q,normalized:null,perceptual_hash:null};
 }
}
