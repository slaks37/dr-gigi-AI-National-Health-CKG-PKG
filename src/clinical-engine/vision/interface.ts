import type { Finding, ImageQuality } from '../types/schema';
export interface ModelAvailability { available:boolean; model_id:string|null; version:string|null; validation_evidence:string|null; approval_id:string|null; limitation:string }
export interface OralVision {
  evaluateModelAvailability():ModelAvailability;
  detectOralRegion(image:Uint8Array,signal?:AbortSignal):Promise<{status:'PRESENT'|'ABSENT'|'INSUFFICIENT_VISIBILITY'|'UNAVAILABLE'}>;
  detectTeeth(image:Uint8Array,index:number,signal?:AbortSignal):Promise<Finding[]>;
  detectFindings(image:Uint8Array,index:number,signal?:AbortSignal):Promise<Finding[]>;
}
export const unavailableVision: OralVision = {
 evaluateModelAvailability:()=>({available:false,model_id:null,version:null,validation_evidence:null,approval_id:null,limitation:'Belum ada detector oral tervalidasi atau bobot klinis yang disetujui.'}),
 detectOralRegion:async()=>({status:'UNAVAILABLE'}), detectTeeth:async()=>[], detectFindings:async()=>[],
};
export function validatedAvailability(vision:OralVision):ModelAvailability {
 const a=vision.evaluateModelAvailability();
 return a.available&&a.model_id&&a.version&&a.validation_evidence&&a.approval_id?a:{available:false,model_id:null,version:null,validation_evidence:null,approval_id:null,limitation:a.limitation||'Model approval incomplete'};
}
export function mapDetectionToImage(box:Finding['box'],quality:ImageQuality,display:{width:number;height:number;mirrored:boolean}) {
 if(!box||!quality.width||!quality.height||display.width<=0||display.height<=0)return null;
 const scale=Math.min(display.width/quality.width,display.height/quality.height);
 const width=quality.width*scale,height=quality.height*scale;
 return {left:(display.width-width)/2+(display.mirrored?1000-box.xmax:box.xmin)/1000*width,top:(display.height-height)/2+box.ymin/1000*height,width:(box.xmax-box.xmin)/1000*width,height:(box.ymax-box.ymin)/1000*height};
}
