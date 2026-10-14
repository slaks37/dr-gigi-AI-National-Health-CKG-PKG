import { createHash } from 'node:crypto';
import type { DatasetEntry } from './schema';
export interface DriveFile {id:string;mimeType:string;size?:string;name?:string}
export interface DrivePage {files:DriveFile[];nextPageToken?:string;incompleteSearch?:boolean}
export interface DriveMetadataProvider {listChildren(parent:string,pageToken?:string):Promise<DrivePage>}
const folderMime='application/vnd.google-apps.folder';
export function anonymousImageId(sourceId:string){return createHash('sha256').update(`drive:${sourceId}`).digest('hex');}
export function safeFolderLabel(name:string):string {
 if(/K0\.2\.3/.test(name))return 'MALFORMED_CODE_REVIEW';
 const code=name.match(/\bK\d{2}(?:\.\d)?\b/)?.[0];if(code)return `WEAK_${code}`;
 const category=['calculus','hypodontia','gingivitis','ulcer','data_caries','tooth_discoloration'].find(c=>name.trim().toLowerCase()===c);return category?`WEAK_${category.toUpperCase()}`:'UNVERIFIED_SOURCE';
}
export async function inventoryDrive(provider:DriveMetadataProvider,root:string,version:string) {
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(root))throw new Error('Invalid source folder');
 const pending=[{id:root,label:'UNVERIFIED_SOURCE'}],seenFolders=new Set<string>(),entries=new Map<string,DatasetEntry>();let complete=true;
 while(pending.length){
  const next=pending.shift()!,folder=next.id;const sourceLabel=next.label;if(seenFolders.has(folder))continue;seenFolders.add(folder);
  if(seenFolders.size>10_000)throw new Error('Folder traversal bound exceeded');
  let token:string|undefined;const seenTokens=new Set<string>();
  do{
   const page=await provider.listChildren(folder,token);if(page.incompleteSearch)complete=false;
   for(const file of page.files){
    if(!/^[A-Za-z0-9_-]{1,128}$/.test(file.id))throw new Error('Invalid source ID');
    if(file.mimeType===folderMime){pending.push({id:file.id,label:safeFolderLabel(file.name??'')});continue;}
    const id=anonymousImageId(file.id);if(entries.has(id))continue;
    entries.set(id,{image_id:id,patient_group_id:null,source_folder_label:sourceLabel,candidate_icd10:null,clinician_verified_label:null,visual_finding_labels:[],review_status:'UNREVIEWED',reviewer_id:null,review_timestamp:null,label_version:'weak-label-1',consent_status:'UNKNOWN',data_usage_permission:'UNKNOWN',permission_evidence_reference:null,source_provenance:'AUTHORIZED_DRIVE_METADATA_ONLY',sha256:null,perceptual_hash:null,duplicate_group_id:null,near_duplicate_group_id:null,quality_status:'NOT_ASSESSED',mime_type:file.mimeType,size_bytes:file.size?Number(file.size):null,width:null,height:null,dataset_version:version,independent_review_status:'PENDING'});
   }
   token=page.nextPageToken;if(token){if(seenTokens.has(token))throw new Error('Non-advancing Drive pagination');seenTokens.add(token);}
  }while(token);
 }
 return{entries:[...entries.values()],folders:seenFolders.size,complete,downloaded_images:0};
}
export function makeDriveApiProvider(accessToken:string,fetcher:typeof fetch=fetch):DriveMetadataProvider {
 if(!accessToken)throw new Error('Authorized read-only Drive credentials required');
 return{listChildren:async(parent,pageToken)=>{
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(parent))throw new Error('Invalid folder');
  const url=new URL('https://www.googleapis.com/drive/v3/files');
  url.search=new URLSearchParams({q:`'${parent}' in parents and trashed=false`,pageSize:'1000',fields:'nextPageToken,incompleteSearch,files(id,name,mimeType,size)',...(pageToken?{pageToken}:{})}).toString();
  const response=await fetcher(url,{headers:{Authorization:`Bearer ${accessToken}`},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('Drive metadata listing unavailable');return response.json() as Promise<DrivePage>;
 }};
}
