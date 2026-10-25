package id.sonri.offline.hybrid

import android.app.Activity
import id.sonri.offline.core.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.security.SecureRandom
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

@Serializable data class CloudIdentity(val uid:String,val email:String,val verified:Boolean,val clinicianVerified:Boolean=false)
@Serializable data class CloudEnvelope(val uid:String,val recordId:String,val revision:Long,val operationId:String,
    val ciphertext:String,val iv:String,val hash:String,val tombstone:Boolean=false,val reviewed:Boolean=false)
@Serializable data class Pending(val recordId:String,val base:Long,val envelope:CloudEnvelope)
@Serializable data class Binding(val uid:String,val revision:Long=0,val hash:String="")
@Serializable data class HybridState(val keys:Map<String,String> = emptyMap(),val bindings:Map<String,Binding> = emptyMap(),
    val pending:List<Pending> = emptyList(),val conflicts:List<String> = emptyList())
data class CloudPage(val records:List<CloudEnvelope>,val cursor:String?)
interface CloudBackend {
    fun observeNetwork(changed:(Boolean)->Unit):()->Unit = {}
    fun releaseConfig():Pair<String,String> = "" to ""
    val configured:Boolean
    fun identity():CloudIdentity?
    suspend fun register(email:String,password:String)
    suspend fun login(email:String,password:String)
    suspend fun google(activity:Activity)
    suspend fun refresh()
    suspend fun verifyEmail()
    suspend fun resetPassword(email:String)
    suspend fun signOut(activity:Activity)
    suspend fun profile(name:String,participation:Boolean):Map<String,Any>
    suspend fun readProfile():Map<String,Any>
    suspend fun requestDeletion()
    suspend fun push(value:CloudEnvelope,expected:Long)
    suspend fun page(cursor:String?):CloudPage
}

/** Random 256-bit recovery code; never derive a key from an account password. Synthetic cloud scope only. */
object SyncCrypto {
    private val json=Json {encodeDefaults=true}
    fun newKey():String=Base64.getUrlEncoder().withoutPadding().encodeToString(ByteArray(32).also{SecureRandom().nextBytes(it)})
    fun key(code:String):ByteArray=Base64.getUrlDecoder().decode(code.trim()).also{require(it.size==32 && code.trim().length==43){"RECOVERY_CODE_REQUIRED"}}
    private fun aad(uid:String,id:String,revision:Long,operation:String,tombstone:Boolean,reviewed:Boolean)=
        "sonri.synthetic.sync.v1|$uid|$id|$revision|$operation|$tombstone|$reviewed".toByteArray()
    fun seal(record:ResearchRecord,uid:String,revision:Long,operation:String,code:String,tombstone:Boolean=false):CloudEnvelope {
        DentalRules.validate(record);require(record.dataKind=="SYNTHETIC" && uid.isNotBlank() && revision>0){"ONLY_SYNTHETIC_CLOUD_RECORDS"}
        val bytes=json.encodeToString(record).toByteArray();require(bytes.size<=200_000)
        val cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,SecretKeySpec(key(code),"AES"));cipher.updateAAD(aad(uid,record.id,revision,operation,tombstone,record.review!=null))
        val encrypted=try{cipher.doFinal(bytes)}finally{bytes.fill(0)}
        return CloudEnvelope(uid,record.id,revision,operation,Base64.getEncoder().encodeToString(encrypted),Base64.getEncoder().encodeToString(cipher.iv),sha256(encrypted),tombstone,record.review!=null)
    }
    fun open(value:CloudEnvelope,uid:String,code:String):ResearchRecord {
        require(value.uid==uid && value.revision>0 && value.ciphertext.length<=280_000)
        val bytes=Base64.getDecoder().decode(value.ciphertext);require(sha256(bytes)==value.hash)
        val cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,SecretKeySpec(key(code),"AES"),GCMParameterSpec(128,Base64.getDecoder().decode(value.iv)))
        cipher.updateAAD(aad(uid,value.recordId,value.revision,value.operationId,value.tombstone,value.reviewed))
        val plain=cipher.doFinal(bytes)
        val record=try{json.decodeFromString<ResearchRecord>(plain.toString(Charsets.UTF_8))}finally{plain.fill(0)}
        DentalRules.validate(record);require(record.id==value.recordId && record.dataKind=="SYNTHETIC" && (record.review!=null)==value.reviewed)
        return record
    }
}
