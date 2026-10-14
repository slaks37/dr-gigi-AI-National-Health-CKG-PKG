import { createHash } from 'node:crypto';
import { DatasetEntry, trainingEligible } from './schema';
export function patientSplit(entries:DatasetEntry[],seed:string) {
 if(!seed)throw new Error('Frozen reproducible seed required');
 const parent=new Map<string,string>();
 const find=(x:string):string=>{const p=parent.get(x);if(!p){parent.set(x,x);return x;}if(p===x)return x;const root=find(p);parent.set(x,root);return root;};
 const join=(a:string,b:string)=>{const aa=find(a),bb=find(b);if(aa!==bb)parent.set(aa,bb);};
 for(const e of entries){if(!trainingEligible(e))throw new Error('Unverified data cannot enter training splits');const patient=`p:${e.patient_group_id}`;join(patient,`h:${e.sha256}`);join(patient,`d:${e.duplicate_group_id}`);join(patient,`n:${e.near_duplicate_group_id}`);}
 const groups=new Map<string,string[]>();for(const key of parent.keys()){const root=find(key);groups.set(root,[...(groups.get(root)??[]),key]);}
 const canonical=new Map([...groups].map(([root,keys])=>[root,keys.sort().join('|')]));
 return entries.map(e=>{
  const group=canonical.get(find(`p:${e.patient_group_id}`))!;
  const n=parseInt(createHash('sha256').update(seed+'|'+group).digest('hex').slice(0,8),16)%100;
  return{image_id:e.image_id,patient_group_id:e.patient_group_id,split:n<70?'TRAIN':n<85?'VALIDATION':'TEST',dataset_version:e.dataset_version};
 });
}
export function hammingDistance(a:string,b:string){if(!/^[a-f0-9]{16}$/.test(a)||!/^[a-f0-9]{16}$/.test(b))throw new Error('Invalid perceptual hash');let n=BigInt('0x'+a)^BigInt('0x'+b),count=0;while(n){count+=Number(n&BigInt(1));n>>=BigInt(1);}return count;}
