package id.sonri.offline.hybrid

import android.app.Activity
import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.ClearCredentialStateRequest
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.firestore.*
import com.google.android.gms.tasks.Task
import id.sonri.offline.BuildConfig
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

suspend fun <T> Task<T>.result():T=suspendCancellableCoroutine{ continuation ->
    addOnSuccessListener{if(continuation.isActive)continuation.resume(it)}
    addOnFailureListener{if(continuation.isActive)continuation.resumeWithException(it)}
}
class FirebaseBackend @JvmOverloads constructor(private val context:Context,private val instanceName:String="sonri-hybrid"):CloudBackend {
    override fun observeNetwork(changed:(Boolean)->Unit):()->Unit {
        val manager=context.getSystemService(android.net.ConnectivityManager::class.java)
        val callback=object:android.net.ConnectivityManager.NetworkCallback(){
            override fun onCapabilitiesChanged(network:android.net.Network,capabilities:android.net.NetworkCapabilities){changed(capabilities.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_VALIDATED))}
            override fun onLost(network:android.net.Network){changed(false)}
        }
        manager.registerDefaultNetworkCallback(callback)
        return {manager.unregisterNetworkCallback(callback)}
    }
    override fun releaseConfig()=BuildConfig.RELEASE_ORIGIN to BuildConfig.RELEASE_PUBLIC_KEY
    override val configured:Boolean = BuildConfig.FIREBASE_PROJECT.let {
        if(BuildConfig.USE_EMULATORS)it=="demo-sonri-hybrid"
        else it.startsWith("sonri-hybrid-") && BuildConfig.PROJECT_APPROVAL.length>=8
    } && BuildConfig.FIREBASE_APP_ID.isNotBlank() && BuildConfig.FIREBASE_API_KEY.isNotBlank()
    private val app by lazy {
        check(configured){"OWNER_APPROVED_EMPTY_SPARK_PROJECT_REQUIRED"}
        FirebaseApp.getApps(context).find{it.name==instanceName} ?: FirebaseApp.initializeApp(context,FirebaseOptions.Builder()
            .setProjectId(BuildConfig.FIREBASE_PROJECT).setApplicationId(BuildConfig.FIREBASE_APP_ID).setApiKey(BuildConfig.FIREBASE_API_KEY).build(),instanceName)
    }
    internal val auth by lazy { FirebaseAuth.getInstance(app).apply{if(BuildConfig.USE_EMULATORS)useEmulator("10.0.2.2",9099)} }
    internal val db by lazy {FirebaseFirestore.getInstance(app).apply{
        firestoreSettings=FirebaseFirestoreSettings.Builder().setLocalCacheSettings(MemoryCacheSettings.newBuilder().build()).build()
        if(BuildConfig.USE_EMULATORS)useEmulator("10.0.2.2",8089)
    }}
    private var clinicianUid:String?=null
    override fun identity():CloudIdentity?=if(!configured)null else auth.currentUser?.let{CloudIdentity(it.uid,it.email.orEmpty(),it.isEmailVerified,it.uid==clinicianUid)}
    private fun uid():String=identity()?.takeIf{it.verified}?.uid ?: error("VERIFIED_EMAIL_REQUIRED")
    override suspend fun register(email:String,password:String){auth.createUserWithEmailAndPassword(email.trim(),password).result();verifyEmail()}
    override suspend fun login(email:String,password:String){auth.signInWithEmailAndPassword(email.trim(),password).result()}
    override suspend fun google(activity:Activity){
        require(BuildConfig.GOOGLE_CLIENT_ID.isNotBlank()){"GOOGLE_PROVIDER_OWNER_CONFIGURATION_REQUIRED"}
        val request=GetCredentialRequest.Builder().addCredentialOption(GetGoogleIdOption.Builder()
            .setServerClientId(BuildConfig.GOOGLE_CLIENT_ID).setFilterByAuthorizedAccounts(false).build()).build()
        val credential=CredentialManager.create(activity).getCredential(activity,request).credential
        require(credential.type==GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL)
        auth.signInWithCredential(GoogleAuthProvider.getCredential(GoogleIdTokenCredential.createFrom(credential.data).idToken,null)).result()
    }
    override suspend fun refresh(){auth.currentUser?.reload()?.result();val claims=auth.currentUser?.getIdToken(true)?.result()?.claims;clinicianUid=auth.currentUser?.uid.takeIf{claims?.get("clinicianVerified")==true}}
    override suspend fun verifyEmail(){val user=auth.currentUser ?: error("LOGIN_REQUIRED");user.sendEmailVerification().result()}
    override suspend fun resetPassword(email:String){auth.sendPasswordResetEmail(email.trim()).result()}
    override suspend fun signOut(activity:Activity){clinicianUid=null;auth.signOut();try{CredentialManager.create(activity).clearCredentialState(ClearCredentialStateRequest())}catch(_:Exception){}}
    override suspend fun readProfile():Map<String,Any> = db.collection("accounts").document(uid()).get(Source.SERVER).result().data.orEmpty()
    override suspend fun profile(name:String,participation:Boolean):Map<String,Any> {
        require(name.trim().length in 1..80)
        val id=uid();val ref=db.collection("accounts").document(id)
        db.runTransaction{tx ->
            val old=tx.get(ref)
            val data=mapOf("uid" to id,"displayName" to name.trim(),"participation" to participation,"accountType" to "RESEARCH_PARTICIPANT",
                "updatedAt" to FieldValue.serverTimestamp(),"state" to "ACTIVE","createdAt" to (old.get("createdAt") ?: FieldValue.serverTimestamp()))
            tx.set(ref,data)
        }.result()
        return db.runTransaction{it.get(ref).data!!}.result()
    }
    override suspend fun requestDeletion(){
        val id=uid();db.collection("deletionRequests").document(id).set(mapOf("uid" to id,"requestedAt" to FieldValue.serverTimestamp(),"scope" to "ACCOUNT_AND_ALL_REVISIONS","status" to "PENDING_OPERATOR_PURGE")).result()
    }
    private fun data(v:CloudEnvelope)=mapOf("uid" to v.uid,"recordId" to v.recordId,"revision" to v.revision,"operationId" to v.operationId,
        "ciphertext" to v.ciphertext,"iv" to v.iv,"hash" to v.hash,"tombstone" to v.tombstone,"reviewed" to v.reviewed,"updatedAt" to FieldValue.serverTimestamp(),"scope" to "SYNTHETIC_ONLY")
    override suspend fun push(value:CloudEnvelope,expected:Long) {
        require(value.uid==uid() && value.revision==expected+1)
        val head=db.collection("accounts").document(value.uid).collection("records").document(value.recordId)
        // A server-source admission read prevents treating a cached transaction as synchronization.
        head.get(Source.SERVER).result()
        db.runTransaction{tx ->
            val old=tx.get(head)
            if(old.getString("operationId")==value.operationId){check(old.getString("hash")==value.hash);return@runTransaction}
            check((old.getLong("revision") ?: 0L)==expected && old.getBoolean("reviewed")!=true){"REVISION_CONFLICT"}
            val values=data(value)
            tx.set(head,values);tx.set(head.collection("revisions").document(value.revision.toString()),values)
        }.result()
    }
    override suspend fun page(cursor:String?):CloudPage {
        var query:Query=db.collection("accounts").document(uid()).collection("records").orderBy(FieldPath.documentId()).limit(20)
        if(cursor!=null)query=query.startAfter(cursor)
        val docs=query.get(Source.SERVER).result().documents
        return CloudPage(docs.map{d -> CloudEnvelope(d.getString("uid")!!,d.id,d.getLong("revision")!!,d.getString("operationId")!!,
            d.getString("ciphertext")!!,d.getString("iv")!!,d.getString("hash")!!,d.getBoolean("tombstone")!!,d.getBoolean("reviewed")!!)},docs.lastOrNull()?.id.takeIf{docs.size==20})
    }
}
