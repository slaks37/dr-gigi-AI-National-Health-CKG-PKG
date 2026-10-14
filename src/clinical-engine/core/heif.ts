import 'server-only';
import { Worker } from 'node:worker_threads';
let activeWorkers=0;
const code=`
 const {parentPort,workerData}=require('node:worker_threads');
 (async()=>{
  const decode=require(workerData.decoderPath);let images;
  try{
   images=await decode.all({buffer:Buffer.from(workerData.bytes)});
   if(images.length!==1)throw new Error('Only single-frame HEIF is supported');
   const first=images[0];
   if(!first.width||!first.height||first.width*first.height>12000000)throw new Error('Pixel limit');
   const result=await first.decode();
   const data=new Uint8Array(result.data);
   parentPort.postMessage({ok:true,width:result.width,height:result.height,pixels:data.buffer},[data.buffer]);
  }catch{parentPort.postMessage({ok:false});}finally{if(images)images.dispose();}
 })();
`;
export async function decodeHeif(bytes:Buffer):Promise<{width:number;height:number;pixels:Buffer}> {
 if(bytes.length>3_000_000||activeWorkers>=2)throw new Error('HEIF decoder capacity unavailable');
 activeWorkers++;
 let worker:Worker;
 try{worker=new Worker(code,{eval:true,workerData:{bytes,decoderPath:require.resolve('heic-decode')},resourceLimits:{maxOldGenerationSizeMb:256,maxYoungGenerationSizeMb:32,stackSizeMb:4},stdout:true,stderr:true});}
 catch{activeWorkers--;throw new Error('HEIF decoder unavailable');}
 worker.stdout?.resume();worker.stderr?.resume();
 return new Promise((resolve,reject)=>{
  let settled=false;
  const stop=()=>{clearTimeout(timer);void worker.terminate();};
  const timer=setTimeout(()=>{if(settled)return;settled=true;stop();reject(new Error('HEIF decoding timed out'));},10000);
  worker.once('message',message=>{
   if(settled)return;settled=true;stop();
   if(!message.ok||!message.width||!message.height||message.width*message.height>12_000_000){reject(new Error('HEIF decoding failed'));return;}
   resolve({width:message.width,height:message.height,pixels:Buffer.from(message.pixels)});
  });
  worker.once('error',()=>{if(settled)return;settled=true;stop();reject(new Error('HEIF decoder unavailable'));});
  worker.once('exit',()=>{activeWorkers--;clearTimeout(timer);if(!settled){settled=true;reject(new Error('HEIF decoder stopped'));}});
 });
}
