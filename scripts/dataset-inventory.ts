import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { inventoryDrive, makeDriveApiProvider } from '../src/dataset/drive-adapter';
async function main(){
 const root=process.env.SONRI_ROOT_FOLDER_ID;
 const token=process.env.GOOGLE_DRIVE_READONLY_ACCESS_TOKEN;
 const out=process.env.DATASET_PRIVATE_OUTPUT;
 if(!root||!token||!out)throw new Error('Authorized Drive connection and private output path are required');
 if(path.resolve(out)===path.resolve(process.cwd())||path.resolve(out).startsWith(path.resolve(process.cwd())+path.sep))throw new Error('Sensitive inventories must be outside the application repository');
 await mkdir(out,{recursive:true,mode:0o700});
 const result=await inventoryDrive(makeDriveApiProvider(token),root,'sonri-metadata-2026-10-14');
 await writeFile(path.join(out,'dataset_inventory.json'),JSON.stringify(result,null,2),{mode:0o600});
 console.log(JSON.stringify({observed_files:result.entries.length,folders:result.folders,complete:result.complete,downloaded_images:0,training_eligible:0}));
}
main().catch(()=>{console.error("Dataset operation blocked: authorized connection, private output and approved manifest are required.");process.exitCode=1;});
