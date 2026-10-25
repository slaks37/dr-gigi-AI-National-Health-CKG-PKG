// Explicit operator-only action. No private key, identity evidence or account payload is printed.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
const args=Object.fromEntries(process.argv.slice(2).filter(a=>a.startsWith('--')).map(a=>{const [key,...value]=a.slice(2).split('=');return [key,value.join('=')||true]}));
const project=String(args.project||'');const uid=String(args.uid||'');const action=String(args.action||'');
if(!project.startsWith('sonri-hybrid-')||!uid||!['verify-clinician','revoke','purge-account'].includes(action))throw Error('DEDICATED_PROJECT_UID_AND_EXACT_ACTION_REQUIRED');
if(String(args['approval-ref']||'').length<8)throw Error('OWNER_APPROVAL_REFERENCE_REQUIRED');
if(args.apply!==true){console.log(JSON.stringify({mode:'DRY_RUN_NO_PROVIDER_CALL',action,project,uid,requires:'Scoped operator ADC; independent credential review for clinician; documented consent/retention decision before purge'}));process.exit(0)}
if(action==='verify-clinician'&&String(args['credential-review-ref']||'').length<8)throw Error('INDEPENDENT_CREDENTIAL_REVIEW_REFERENCE_REQUIRED');
if(action==='purge-account'&&args['confirm-permanent-deletion']!==true)throw Error('EXPLICIT_PERMANENT_DELETION_FLAG_REQUIRED');
const app=initializeApp({credential:applicationDefault(),projectId:project});const auth=getAuth(app);const db=getFirestore(app);
if(action==='verify-clinician'){
 const user=await auth.getUser(uid);if(!user.emailVerified||user.disabled)throw Error('ACTIVE_VERIFIED_EMAIL_REQUIRED');
 await auth.setCustomUserClaims(uid,{...user.customClaims,clinicianVerified:true});
 await db.doc(`operatorAudit/${crypto.randomUUID()}`).set({action,uid,approvalReference:args['approval-ref'],credentialReviewReference:args['credential-review-ref'],at:FieldValue.serverTimestamp()});
}else if(action==='revoke'){
 await db.doc(`accounts/${uid}`).update({state:'DISABLED',updatedAt:FieldValue.serverTimestamp()});
 await auth.updateUser(uid,{disabled:true});await auth.revokeRefreshTokens(uid);
}else{
 const request=await db.doc(`deletionRequests/${uid}`).get();if(request.data()?.status!=='PENDING_OPERATOR_PURGE')throw Error('OWNER_DELETION_REQUEST_REQUIRED');
 await db.doc(`accounts/${uid}`).update({state:'DISABLED',updatedAt:FieldValue.serverTimestamp()});
 await auth.updateUser(uid,{disabled:true});await auth.revokeRefreshTokens(uid);
 await db.recursiveDelete(db.doc(`accounts/${uid}`));await auth.deleteUser(uid);await db.doc(`deletionRequests/${uid}`).delete();
}
console.log(JSON.stringify({action,status:'OPERATOR_ACTION_COMPLETED_VERIFY_PROVIDER_STATE_SEPARATELY'}));
