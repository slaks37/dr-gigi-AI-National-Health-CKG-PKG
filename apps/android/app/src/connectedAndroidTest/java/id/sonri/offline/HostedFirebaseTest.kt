package id.sonri.offline

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuthException
import com.google.firebase.firestore.FirebaseFirestoreException
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.Source
import id.sonri.offline.core.*
import id.sonri.offline.hybrid.*
import kotlinx.coroutines.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.security.MessageDigest
import java.time.Instant
import java.util.UUID

/** Opt-in LIVE Spark acceptance, synthetic records only. No Admin SDK or email-verification shortcut. */
@RunWith(AndroidJUnit4::class)
class HostedFirebaseTest {
    @Serializable private data class Session(
        val emailHash:String, val initialPasswordHash:String, val uid:String="", val registered:Boolean=false,
        val key:String="", val record:ResearchRecord?=null, val accepted:Boolean=false,
        val recoveryRequested:Boolean=false, val queueRecord:ResearchRecord?=null,
    )
    private val json=Json { encodeDefaults=true }
    private val results=linkedMapOf<String,String>()
    private var step="INPUT_VALIDATION"
    private fun hash(value:String)=sha256(value.toByteArray())
    private fun fileHash(file:File):String {
        val digest=MessageDigest.getInstance("SHA-256")
        file.inputStream().use{stream -> val buffer=ByteArray(64*1024);while(true){val count=stream.read(buffer);if(count<0)break;digest.update(buffer,0,count)}}
        return digest.digest().joinToString(""){"%02x".format(it)}
    }
    private fun requireStep(ok:Boolean,name:String){step=name;check(ok)}
    /** Exception type and enumerated provider codes only; never SDK messages, causes' messages, or payloads. */
    private fun safeFailure(prefix:String,failure:Throwable){
        results["${prefix}_exception_class"]=failure.javaClass.name
        var current:Throwable?=failure
        val visited=mutableSetOf<Throwable>()
        repeat(5){
            val value=current ?: return@repeat
            if(!visited.add(value)){current=null;return@repeat}
            if(value is FirebaseFirestoreException)results["${prefix}_firestore_code"]=value.code.name
            if(value is FirebaseAuthException)results["${prefix}_auth_code"]=value.errorCode.takeIf{it.matches(Regex("ERROR_[A-Z0-9_]{1,100}"))} ?: "NONSTANDARD_CODE_WITHHELD"
            current=value.cause
        }
    }
    private suspend fun denied(name:String,block:suspend ()->Unit){
        step=name
        var code:FirebaseFirestoreException.Code?=null
        try{block();results["${name}_call_outcome"]="UNEXPECTED_SUCCESS"}
        catch(e:Throwable){
            results["${name}_call_outcome"]="EXCEPTION";safeFailure(name,e)
            if(e is FirebaseFirestoreException)code=e.code
        }
        check(code==FirebaseFirestoreException.Code.PERMISSION_DENIED)
        results[name]="PASS_PERMISSION_DENIED"
    }
    private suspend fun rejected(name:String,block:suspend ()->Unit){
        step=name;var rejected=false
        try{block()}catch(_:Exception){rejected=true}
        check(rejected);results[name]="PASS_REJECTED_AND_SERVER_STATE_CHECKED_SEPARATELY"
    }
    private suspend fun awaitAction(cloud:HybridController){withTimeout(40_000){while(cloud.busy)delay(20)}}

    @Test fun executeExplicitHostedStage()=runBlocking {
        val instrumentation=InstrumentationRegistry.getInstrumentation()
        val context=instrumentation.targetContext
        val inputFile=File(context.noBackupFilesDir,"hosted-input.json")
        assumeTrue("HOSTED_INPUT_REQUIRED_NOT_AN_AUTOMATIC_CI_TEST",inputFile.isFile)
        val reportFile=File(context.noBackupFilesDir,"hosted-evidence.json")
        var runId="";var stage="";var status="FAIL";var uidHash="";var recordHash=""
        val clients=mutableListOf<String>()
        try {
            // Delete the short-lived plaintext credential input immediately after parsing.
            val input=try{require(inputFile.length() in 2..16_384);json.parseToJsonElement(inputFile.readText()).jsonObject}finally{inputFile.delete()}
            val allowed=setOf("stage","runId","approvedProject","ownerApprovalReference","authorizeSyntheticAccountOperations","email","password","otherEmail","otherPassword","passwordResetCompletedByOwner")
            requireStep(input.keys.all{it in allowed},"ONLY_REVIEWED_INPUT_FIELDS_ALLOWED")
            fun text(name:String)=input[name]?.jsonPrimitive?.content.orEmpty()
            runId=text("runId");stage=text("stage")
            requireStep(runId.matches(Regex("[a-z0-9-]{8,64}")),"SAFE_RUN_ID_REQUIRED")
            requireStep(stage in setOf("register","accept","other-denial","recovery-request","recovery-confirm"),"EXPLICIT_STAGE_REQUIRED")
            requireStep(!BuildConfig.USE_EMULATORS && BuildConfig.NETWORK_ENABLED,"HOSTED_CONNECTED_BUILD_REQUIRED")
            requireStep(BuildConfig.FIREBASE_PROJECT.startsWith("sonri-hybrid-") && text("approvedProject")==BuildConfig.FIREBASE_PROJECT,"EXACT_APPROVED_PROJECT_REQUIRED")
            requireStep(BuildConfig.PROJECT_APPROVAL.length>=8 && text("ownerApprovalReference")==BuildConfig.PROJECT_APPROVAL,"OWNER_APPROVAL_REFERENCE_REQUIRED")
            requireStep(input["authorizeSyntheticAccountOperations"]?.jsonPrimitive?.booleanOrNull==true,"EXPLICIT_SYNTHETIC_ACCOUNT_OPERATIONS_REQUIRED")
            val email=text("email").trim();val password=text("password")
            requireStep(email.contains('@') && !email.endsWith(".test") && password.length in 12..128,"REAL_CONTROLLED_MAILBOX_AND_PRIVATE_PASSWORD_REQUIRED")
            val storage=ProtectedState(context,"hosted-session-$runId")
            var state=storage.read()?.let{json.decodeFromString<Session>(it)} ?: Session(hash(email.lowercase()),hash(password))
            requireStep(state.emailHash==hash(email.lowercase()),"RUN_MAILBOX_BINDING_REQUIRED")
            fun save(){storage.write(json.encodeToString(state))}
            fun client(suffix:String):FirebaseBackend {
                val name="hosted-$runId-$suffix";clients+=name
                return FirebaseBackend(context,name)
            }
            val a=client("A")
            requireStep(a.configured,"PUBLIC_CLIENT_CONFIGURATION_REQUIRED")
            suspend fun loginVerified():Boolean {
                step="REAL_EMAIL_LOGIN";a.auth.signOut();a.login(email,password);a.refresh()
                val identity=a.identity() ?: error("LOGIN_REQUIRED")
                if(!identity.verified){results["real_email_verification"]="WAITING_FOR_OWNER_EMAIL_VERIFICATION";status="WAITING_FOR_OWNER_EMAIL_VERIFICATION";return false}
                requireStep(state.uid.isBlank() || state.uid==identity.uid,"SAME_ACCOUNT_REQUIRED")
                uidHash=hash(identity.uid);results["real_email_verification"]="PASS_REFRESHED_AUTH_USER_AND_TOKEN"
                return true
            }
            withTimeout(180_000) {
                when(stage) {
                    "register" -> {
                        a.auth.signOut()
                        if(state.registered){
                            requireStep(hash(password)==state.initialPasswordHash,"REGISTER_RESUME_REQUIRES_ORIGINAL_PRIVATE_ACCOUNT_PASSWORD")
                            step="RESUME_EXISTING_REGISTRATION_WITHOUT_EMAIL_RESEND";a.login(email,password);a.refresh()
                            requireStep(a.identity()?.uid==state.uid,"REGISTER_RESUME_REQUIRES_SAME_UID")
                            results["real_registration"]="RESUMED_EXISTING_ACCOUNT_LOGIN_NO_NEW_ACCOUNT_OR_EMAIL_SEND"
                            results["verification_email"]="PREVIOUS_REQUEST_RETAINED_NOT_RESENT_BY_RESUME"
                        }else{
                            step="REAL_REGISTRATION_AND_VERIFICATION_EMAIL_REQUEST";a.register(email,password)
                            results["real_registration"]="PASS_REAL_FIREBASE_AUTH_ACCOUNT_CREATED"
                            results["verification_email"]="REQUEST_ACCEPTED_DELIVERY_AND_LINK_ACTION_PENDING_OWNER"
                        }
                        val identity=a.identity()!!
                        requireStep(!identity.verified,"NEW_EMAIL_ACCOUNT_MUST_BEGIN_UNVERIFIED")
                        state=state.copy(uid=identity.uid,registered=true);save();uidHash=hash(identity.uid)
                        denied("unverified_server_access_denied"){a.db.collection("accounts").document(identity.uid).get(Source.SERVER).result()}
                        status="WAITING_FOR_OWNER_EMAIL_VERIFICATION"
                    }
                    "accept" -> {
                        requireStep(state.registered && !state.accepted,"REGISTER_FIRST_OR_USE_A_FRESH_RUN_FOR_REPEAT_ACCEPTANCE")
                        if(!loginVerified())return@withTimeout
                        val uid=a.identity()!!.uid
                        step="HOSTED_PROFILE_CREATE";a.profile("SYNTHETIC HOSTED RESEARCH",false)
                        requireStep(a.readProfile()["accountType"]=="RESEARCH_PARTICIPANT","HOSTED_PROFILE_SERVER_READ")
                        results["profile"]="PASS_SERVER_PROFILE_NO_SELF_ASSIGNED_ROLE"
                        val key=state.key.ifBlank{SyncCrypto.newKey()}
                        val record=state.record ?: ResearchRecord(alias="SYNTHETIC hosted acceptance",researchConsent=true)
                        state=state.copy(key=key,record=record);save()
                        val first=SyncCrypto.seal(record,uid,1,UUID.randomUUID().toString(),key)
                        step="ENCRYPTED_HOSTED_WRITE";a.push(first,0);a.push(first,0)
                        val head=a.db.collection("accounts").document(uid).collection("records").document(record.id)
                        requireStep(head.collection("revisions").get(Source.SERVER).result().size()==1,"IDEMPOTENT_RETRY_HAS_ONE_REVISION")
                        requireStep(head.get(Source.SERVER).result().data?.keys?.none{it in setOf("alias","examination","image","recoveryKey","password") }==true,"NO_PLAINTEXT_RECORD_FIELDS_IN_SERVER_ENVELOPE")
                        results["encrypted_write_and_idempotency"]="PASS_REAL_SERVER_HEAD_AND_SINGLE_IMMUTABLE_REVISION"
                        val b=client("B");b.auth.signOut();step="INDEPENDENT_CLIENT_REAUTHENTICATION";b.login(email,password);b.refresh()
                        requireStep(b.identity()?.verified==true && b.identity()?.uid==uid,"INDEPENDENT_AUTH_SESSION_REQUIRED")
                        val restored=SyncCrypto.open(b.page(null).records.single{it.recordId==record.id},uid,key)
                        requireStep(restored==record,"EXACT_INDEPENDENT_SERVER_RESTORE")
                        recordHash=hash(json.encodeToString(restored));results["independent_authenticated_restore"]="PASS_TWO_NAMED_AUTH_CLIENT_SESSIONS_ONE_ANDROID_ENVIRONMENT"
                        val edited=record.copy(alias="SYNTHETIC hosted second revision")
                        val second=SyncCrypto.seal(edited,uid,2,UUID.randomUUID().toString(),key)
                        step="SECOND_REVISION";b.push(second,1)
                        rejected("stale_revision_rejected"){a.push(SyncCrypto.seal(record,uid,2,UUID.randomUUID().toString(),key),1)}
                        requireStep(SyncCrypto.open(b.page(null).records.single{it.recordId==record.id},uid,key)==edited,"STALE_WRITE_DID_NOT_CHANGE_SERVER_HEAD")
                        val reviewed=edited.copy(review=LocalReview("K02.9","Synthetic test reviewer","Synthetic access-control fixture; no clinical diagnosis or validation."))
                        step="SYNTHETIC_REVIEWED_REVISION";b.push(SyncCrypto.seal(reviewed,uid,3,UUID.randomUUID().toString(),key),2)
                        rejected("reviewed_head_protected"){a.push(SyncCrypto.seal(record,uid,4,UUID.randomUUID().toString(),key),3)}
                        denied("hosted_rules_reviewed_revision_denied"){
                            // Bypass the app's preflight guard to verify the DEPLOYED server rule itself.
                            val invalid=head.get(Source.SERVER).result().data!!.toMutableMap().apply{
                                put("revision",4L);put("operationId",UUID.randomUUID().toString());put("updatedAt",FieldValue.serverTimestamp())
                            }
                            a.db.batch().set(head,invalid).set(head.collection("revisions").document("4"),invalid).commit().result()
                        }
                        requireStep(SyncCrypto.open(b.page(null).records.single{it.recordId==record.id},uid,key)==reviewed,"REVIEWED_SERVER_HEAD_PRESERVED")
                        // Exercise the actual encrypted product outbox with a REAL hosted backend.
                        val scope=CoroutineScope(SupervisorJob()+Dispatchers.Main)
                        val queueName="hosted-queue-$runId"
                        var cloud=HybridController(context,scope,a,queueName)
                        val queued=ResearchRecord(alias="SYNTHETIC durable offline queue",researchConsent=true)
                        try {
                            cloud.reset();cloud.load();cloud.key(key);cloud.migrate(listOf(queued),true)
                            step="REAL_SDK_NETWORK_DISABLED";a.db.disableNetwork().result()
                            cloud.sync{_,_->};awaitAction(cloud)
                            requireStep(cloud.pendingCount==1,"OFFLINE_FAILURE_RETAINS_ENCRYPTED_OUTBOX")
                            cloud.lock();cloud=HybridController(context,scope,a,queueName);cloud.load()
                            requireStep(cloud.pendingCount==1,"RECREATED_CONTROLLER_RESTORES_ENCRYPTED_PENDING_RECORD")
                            step="REAL_SDK_RECONNECT";a.db.enableNetwork().result();a.readProfile()
                            var injectedCalls=0
                            val quotaBackend=object:CloudBackend by a {
                                override suspend fun push(value:CloudEnvelope,expected:Long){
                                    injectedCalls++
                                    throw FirebaseFirestoreException("SYNTHETIC_QUOTA_FAILURE_INJECTION",FirebaseFirestoreException.Code.RESOURCE_EXHAUSTED)
                                }
                            }
                            cloud.lock();cloud=HybridController(context,scope,quotaBackend,queueName);cloud.load()
                            step="CONTROLLED_RESOURCE_EXHAUSTED_INJECTION";cloud.sync{_,_->};awaitAction(cloud)
                            requireStep(injectedCalls==1 && cloud.pendingCount==1,"INJECTED_QUOTA_FAILURE_RETAINS_PENDING_RECORD")
                            cloud.lock();cloud=HybridController(context,scope,a,queueName);cloud.load()
                            requireStep(cloud.pendingCount==1,"POST_QUOTA_CONTROLLER_RELOAD_RETAINS_ENCRYPTED_PENDING_RECORD")
                            results["controlled_quota_failure"]="PASS_INJECTED_RESOURCE_EXHAUSTED_ACTUAL_HYBRID_CONTROLLER_PRESERVES_AND_RELOADS_QUEUE_NOT_PROVIDER_QUOTA_EXHAUSTION"
                            step="REAL_BACKEND_RETRY_AFTER_INJECTED_QUOTA_FAILURE";cloud.sync{_,_->};awaitAction(cloud)
                            requireStep(cloud.pendingCount==0,"RECONNECT_ACKNOWLEDGES_PENDING_RECORD")
                            requireStep(SyncCrypto.open(b.page(null).records.single{it.recordId==queued.id},uid,key)==queued,"QUEUED_RECORD_RESTORED_FROM_HOSTED_SERVER")
                            results["offline_queue_and_restart_recovery"]="PASS_ACTUAL_HYBRID_CONTROLLER_ENCRYPTED_OUTBOX_SDK_OFFLINE_RELOAD_RECONNECT"
                        }finally{a.db.enableNetwork().result();cloud.reset();scope.cancel()}
                        state=state.copy(record=reviewed,queueRecord=queued,accepted=true);save()
                        step="EXPLICIT_SIGN_OUT";a.auth.signOut();b.auth.signOut();requireStep(a.identity()==null && b.identity()==null,"SIGN_OUT_CLEARS_AUTH_IDENTITIES")
                        results["logout"]="PASS_BOTH_NAMED_AUTH_SESSIONS_SIGNED_OUT"
                        if(text("otherEmail").isNotBlank() && text("otherPassword").isNotBlank()) {
                            checkOther(client("other"),text("otherEmail"),text("otherPassword"),uid,record.id)
                        }else results["verified_other_account_denial"]="NOT_TESTED_OWNER_VERIFIED_OTHER_ACCOUNT_REQUIRED"
                        status="PASS"
                    }
                    "other-denial" -> {
                        requireStep(state.accepted && state.record!=null,"COMPLETED_ACCEPTANCE_REQUIRED")
                        requireStep(text("otherEmail").isNotBlank() && text("otherPassword").length>=12,"PRIVATE_VERIFIED_OTHER_ACCOUNT_INPUT_REQUIRED")
                        checkOther(client("other"),text("otherEmail"),text("otherPassword"),state.uid,state.record!!.id)
                        status="PASS"
                    }
                    "recovery-request" -> {
                        requireStep(state.accepted,"COMPLETED_ACCEPTANCE_REQUIRED")
                        if(!loginVerified())return@withTimeout
                        step="REAL_PASSWORD_RESET_EMAIL_REQUEST";a.resetPassword(email)
                        state=state.copy(recoveryRequested=true);save()
                        results["password_reset_email"]="REQUEST_ACCEPTED_COMPLETED_EMAIL_LINK_RESET_NOT_YET_PROVEN"
                        status="WAITING_FOR_OWNER_PASSWORD_RESET"
                    }
                    "recovery-confirm" -> {
                        requireStep(state.accepted && state.recoveryRequested,"REAL_PASSWORD_RESET_REQUEST_REQUIRED")
                        requireStep(input["passwordResetCompletedByOwner"]?.jsonPrimitive?.booleanOrNull==true && hash(password)!=state.initialPasswordHash,"OWNER_EMAIL_LINK_RESET_AND_DIFFERENT_NEW_PASSWORD_REQUIRED")
                        if(!loginVerified())return@withTimeout
                        val records=a.page(null).records
                        val restored=SyncCrypto.open(records.single{it.recordId==state.record!!.id},state.uid,state.key)
                        requireStep(restored==state.record,"RECOVERY_RESTORES_EXACT_REVIEWED_RECORD")
                        requireStep(SyncCrypto.open(records.single{it.recordId==state.queueRecord!!.id},state.uid,state.key)==state.queueRecord,"RECOVERY_RESTORES_EXACT_QUEUED_RECORD")
                        recordHash=hash(json.encodeToString(restored))
                        results["password_reset_reauthentication_and_restore"]="PASS_OWNER_ATTESTED_EMAIL_LINK_ACTION_DIFFERENT_NEW_PASSWORD_AUTH_AND_SERVER_DECRYPTION"
                        a.auth.signOut();status="PASS"
                    }
                }
            }
        }catch(failure:Throwable){status="FAIL";safeFailure("outer_failure",failure)}
        finally {
            inputFile.delete()
            val report=buildJsonObject {
                put("schema","sonri.hosted.android-stage.v1");put("run_id",runId);put("stage",stage);put("status",status)
                put("executed_at_utc",Instant.now().toString());put("approved_project",BuildConfig.FIREBASE_PROJECT)
                put("use_emulators",BuildConfig.USE_EMULATORS);put("last_step",step)
                put("apk_sha256",fileHash(File(context.applicationInfo.sourceDir)))
                put("instrumentation_apk_sha256",fileHash(File(instrumentation.context.applicationInfo.sourceDir)))
                put("uid_sha256",uidHash);put("restored_synthetic_record_sha256",recordHash)
                put("results",JsonObject(results.mapValues{JsonPrimitive(it.value)}))
                put("scope","REAL_HOSTED_FIREBASE_TWO_NAMED_AUTH_CLIENT_SESSIONS_ONE_ANDROID_ENVIRONMENT_TEST_API_NOT_PRODUCT_UI")
                put("email_link_actions","OWNER_PERFORMS_REAL_MAILBOX_ACTIONS_NO_ADMIN_VERIFICATION_OR_RESET_SHORTCUT")
                put("physical_devices_tested",0);put("patient_data_sync",false);put("clinical_use","PROHIBITED")
                put("google_sign_in_tested",false);put("real_quota_exhaustion_tested",false);put("app_distribution_tested",false)
                put("controlled_quota_failure_injected",results.containsKey("controlled_quota_failure"))
            }
            reportFile.writeText(report.toString())
            // Dispose named clients; retain only encrypted cross-stage synthetic recovery state.
            clients.forEach{name -> try{FirebaseApp.getInstance(name).delete()}catch(_:Exception){}}
        }
        if(status=="FAIL")throw AssertionError("HOSTED_STAGE_FAILED_REDACTED_STEP_$step")
    }

    private suspend fun checkOther(other:FirebaseBackend,email:String,password:String,ownerUid:String,recordId:String){
        step="VERIFIED_OTHER_ACCOUNT_LOGIN";other.auth.signOut();other.login(email.trim(),password);other.refresh()
        requireStep(other.identity()?.verified==true && other.identity()?.uid!=ownerUid,"SEPARATELY_VERIFIED_OTHER_ACCOUNT_REQUIRED")
        denied("verified_other_profile_access_denied"){other.db.collection("accounts").document(ownerUid).get(Source.SERVER).result()}
        denied("verified_other_ciphertext_access_denied"){other.db.collection("accounts").document(ownerUid).collection("records").document(recordId).get(Source.SERVER).result()}
        results["verified_other_account_denial"]="PASS_REAL_SERVER_PERMISSION_DENIED_VERIFIED_DISTINCT_UID";other.auth.signOut()
    }
}
