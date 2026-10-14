import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { DatasetEntrySchema, AnnotationSchema } from '../src/dataset/schema';
import { prepareTraining, ApprovedAnnotation } from '../src/dataset/training';
async function main(){
 const [manifestPath,annotationPath,optionsPath,outputPath]=process.argv.slice(2);
 if(!manifestPath||!annotationPath||!optionsPath||!outputPath)throw new Error('Use private manifest, approved annotations, clinical approval options and private output path');
 if(path.resolve(outputPath)===path.resolve(process.cwd())||path.resolve(outputPath).startsWith(path.resolve(process.cwd())+path.sep))throw new Error('Training assets must stay outside the application repository');
 const rows=JSON.parse(await readFile(manifestPath,'utf8')).map((row:unknown)=>DatasetEntrySchema.parse(row));
 const annotations=JSON.parse(await readFile(annotationPath,'utf8')).map((row:ApprovedAnnotation)=>({...AnnotationSchema.parse(Object.fromEntries(Object.keys(AnnotationSchema.shape).map(k=>[k,row[k as keyof ApprovedAnnotation]]))),verification_status:row.verification_status,author_uid:row.author_uid,clinical_reviewer_uid:row.clinical_reviewer_uid,image_sha256:row.image_sha256,annotation_id:row.annotation_id,version:row.version,reviewed_finding_type:row.reviewed_finding_type}));
 const options=JSON.parse(await readFile(optionsPath,'utf8'));
 const prepared=prepareTraining(rows,annotations,options);
 await mkdir(outputPath,{recursive:true,mode:0o700});await writeFile(path.join(outputPath,'training-manifest.json'),JSON.stringify(prepared,null,2),{mode:0o600});
 console.log(JSON.stringify({prepared:true,split_counts:prepared.split_counts,models_trained:0,clinical_validity:'NOT_ESTABLISHED'}));
}
main().catch(()=>{console.error("Dataset operation blocked: authorized connection, private output and approved manifest are required.");process.exitCode=1;});
