package id.sonri.offline.hybrid

import id.sonri.offline.core.sha256
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.security.KeyFactory
import java.security.Signature
import java.security.spec.X509EncodedKeySpec
import java.time.Instant
import java.util.Base64
import java.net.URI

@Serializable data class SignedEnvelope(val payload:String,val signature:String)
@Serializable data class ModelRelease(val version:Int,val path:String,val bytes:Long,val sha256:String,val contract:String="SOFTWARE_KERNEL_TEST")
@Serializable data class ApplicationRelease(val versionCode:Int,val packageName:String,val certificateSha256:String,val installUrl:String)
@Serializable data class ReleaseManifest(val schema:Int=1,val sequence:Int,val expiresAt:String,val minimumSafeVersion:Int,
    val models:List<ModelRelease>,val application:ApplicationRelease?=null)
@Serializable data class UpdateState(val sequence:Int=0,val floor:Int=0,val payloadHash:String="",val manifest:ReleaseManifest?=null,
    val active:ModelRelease?=null,val previous:ModelRelease?=null)
object SignedUpdates {
    fun compatibleApp(release:ApplicationRelease,installedVersion:Long,packageName:String,certificate:String)=
        release.versionCode>installedVersion && release.packageName==packageName && release.certificateSha256==certificate
    private val json=Json {encodeDefaults=true}
    fun verify(bytes:ByteArray,publicKey:String,origin:String,old:UpdateState,now:Instant=Instant.now()):Pair<ReleaseManifest,String> {
        require(bytes.size in 1..32000 && publicKey.isNotBlank())
        val endpoint=URI(origin);require(endpoint.scheme=="https" && endpoint.host!=null && endpoint.userInfo==null && endpoint.query==null && endpoint.fragment==null)
        val envelope=json.decodeFromString<SignedEnvelope>(bytes.toString(Charsets.UTF_8));val payload=Base64.getDecoder().decode(envelope.payload)
        val key=KeyFactory.getInstance("EC").generatePublic(X509EncodedKeySpec(Base64.getDecoder().decode(publicKey)))
        require(Signature.getInstance("SHA256withECDSA").run{initVerify(key);update(payload);verify(Base64.getDecoder().decode(envelope.signature))}){"SIGNATURE_REJECTED"}
        val m=json.decodeFromString<ReleaseManifest>(payload.toString(Charsets.UTF_8));val hash=sha256(payload)
        require(m.schema==1 && m.sequence>=old.sequence && (m.sequence!=old.sequence || hash==old.payloadHash))
        require(Instant.parse(m.expiresAt).isAfter(now) && Instant.parse(m.expiresAt).isBefore(now.plusSeconds(32L*86400)))
        require(m.minimumSafeVersion>=old.floor && m.models.size in 1..5 && m.models.map{it.version}.distinct().size==m.models.size)
        m.models.forEach{require(it.version>=m.minimumSafeVersion && it.bytes in 1..25_000_000 && it.sha256.matches(Regex("[a-f0-9]{64}")) && it.path.matches(Regex("/[a-zA-Z0-9_.-]+")) && it.contract=="SOFTWARE_KERNEL_TEST")}
        m.application?.let{require(it.versionCode>0 && it.packageName=="id.sonri.offline.research" && it.certificateSha256.matches(Regex("[a-f0-9]{64}")) && URI(it.installUrl).scheme=="https" && URI(it.installUrl).userInfo==null)}
        return m to hash
    }
}
