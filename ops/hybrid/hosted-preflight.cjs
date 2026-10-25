// Read-only provider metadata, using the existing Firebase CLI session in memory.
// Never serialize CLI credentials or raw Auth/OAuth configuration.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const approval = require('./owner-approval.v1.json');
const args = Object.fromEntries(process.argv.slice(2).map(x => {const [k,...v]=x.replace(/^--/,'').split('=');return [k,v.join('=')];}));
if(args.project!==approval.projectId || !/^sonri-hybrid-[a-z0-9-]+$/.test(args.project) || approval.billingAccountLinkAllowed!==false || approval.syntheticOnly!==true) {
  console.error('EXACT_APPROVED_SYNTHETIC_PROJECT_REQUIRED_NO_PROVIDER_CALL');process.exit(2);
}
if(!args.output) {console.error('PRIVATE_LOCAL_OUTPUT_PATH_REQUIRED_NO_PROVIDER_CALL');process.exit(2);}
const {getGlobalDefaultAccount}=require('firebase-tools/lib/auth');
const {requireAuth}=require('firebase-tools/lib/requireAuth');
const {Client}=require('firebase-tools/lib/apiv2');
const project=args.project;
async function get(origin,version,resource) {
  try {return {ok:true,data:(await new Client({urlPrefix:origin,apiVersion:version}).get(resource)).body};}
  catch(e) {return {ok:false,httpStatus:e.status || e.context?.response?.statusCode || null};}
}
(async()=>{
  const account=getGlobalDefaultAccount();if(!account)throw Error('OWNER_CLI_LOGIN_REQUIRED');
  await requireAuth({...account,project,nonInteractive:true});
  const billing=await get('https://cloudbilling.googleapis.com','v1',`projects/${project}/billingInfo`);
  const apps=await get('https://firebase.googleapis.com','v1beta1',`projects/${project}/androidApps`);
  const db=await get('https://firestore.googleapis.com','v1',`projects/${project}/databases`);
  const config=await get('https://identitytoolkit.googleapis.com','admin/v2',`projects/${project}/config`);
  const google=await get('https://identitytoolkit.googleapis.com','admin/v2',`projects/${project}/defaultSupportedIdpConfigs/google.com`);
  const release=await get('https://firebaserules.googleapis.com','v1',`projects/${project}/releases/cloud.firestore`);
  const ruleset=release.ok?await get('https://firebaserules.googleapis.com','v1',release.data.rulesetName):{ok:false};
  const ruleFiles=ruleset.data?.source?.files||[];
  const expected=fs.readFileSync(path.join(__dirname,'firestore.rules'),'utf8');
  const android=[];
  for(const app of apps.data?.apps || []) {
    const hashes=await get('https://firebase.googleapis.com','v1beta1',`${app.name}/sha`);
    android.push({appId:app.appId,packageName:app.packageName,shaCertificates:hashes.data?.certificates?.map(x=>({type:x.certType,hash:x.shaHash}))||[],hashListRead:hashes.ok});
  }
  const r={schema:'sonri.hybrid.hosted-preflight.v1',checkedAt:new Date().toISOString(),projectId:project,approvalReference:approval.approvalReference,
    billing:{read:billing.ok,httpStatus:billing.httpStatus,billingEnabled:billing.data?.billingEnabled??null,billingAccountLinked:billing.ok?Boolean(billing.data?.billingAccountName):null},
    androidApps:android,androidListRead:apps.ok,
    databases:db.data?.databases?.map(d=>({name:d.name,locationId:d.locationId,type:d.type,databaseEdition:d.databaseEdition,pointInTimeRecoveryEnablement:d.pointInTimeRecoveryEnablement}))||[],databaseListRead:db.ok,
    auth:{configRead:config.ok,httpStatus:config.httpStatus,emailPasswordEnabled:config.ok?Boolean(config.data?.signIn?.email?.enabled && config.data?.signIn?.email?.passwordRequired):null,googleProviderRead:google.ok,googleEnabled:google.ok?google.data.enabled:null,googleWebClientId:google.ok?google.data.clientId:null},
    dedicatedRules:{activeReleaseRead:release.ok,rulesetRead:ruleset.ok,exactReviewedSource:ruleset.ok && ruleFiles.length===1 && ruleFiles[0].content===expected,sha256:crypto.createHash('sha256').update(expected).digest('hex')},
    rawCredentialsEmitted:false,providerWritesPerformed:false};
  r.noBillingVerified=billing.ok && r.billing.billingEnabled===false && r.billing.billingAccountLinked===false;
  fs.mkdirSync(path.dirname(args.output),{recursive:true});fs.writeFileSync(args.output,JSON.stringify(r,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({projectId:project,noBillingVerified:r.noBillingVerified,androidApps:android.length,databases:r.databases.length,emailPasswordEnabled:r.auth.emailPasswordEnabled}));
  if(!r.noBillingVerified)process.exitCode=3;
})().catch(()=>{console.error('PREFLIGHT_FAILED_NO_CREDENTIALS_OR_RAW_PROVIDER_RESPONSE_EMITTED');process.exitCode=1;});
