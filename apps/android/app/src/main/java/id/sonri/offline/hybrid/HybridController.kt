package id.sonri.offline.hybrid

import android.app.Activity
import android.content.Context
import androidx.compose.runtime.*
import id.sonri.offline.BuildConfig
import id.sonri.offline.core.*
import kotlinx.coroutines.*
import kotlinx.serialization.json.Json
import java.util.UUID

class HybridController(context:Context,private val scope:CoroutineScope,provided:CloudBackend?=null,stateName:String="sync-state") {
    val backend:CloudBackend?=provided ?: if(BuildConfig.NETWORK_ENABLED)Class.forName("id.sonri.offline.hybrid.FirebaseBackend").getConstructor(Context::class.java).newInstance(context) as CloudBackend else null
    private val storage=ProtectedState(context,stateName)
    private val json=Json {encodeDefaults=true}
    private var state=HybridState()
    var identity by mutableStateOf<CloudIdentity?>(null);private set
    var status by mutableStateOf("Mode tamu lokal; belum terhubung ke akun");private set
    var busy by mutableStateOf(false);private set
    var pendingCount by mutableIntStateOf(0);private set
    var conflicts by mutableStateOf<List<String>>(emptyList());private set
    var cursor by mutableStateOf<String?>(null);private set
    var recovery by mutableStateOf("");private set
    var profileName by mutableStateOf("");private set
    var participation by mutableStateOf(false);private set
    private var unlocked=false;private var task:Job?=null;private var epoch=0;private var retryAfter=0L
    var onIdentityChanged:()->Unit={}
    fun load(){state=storage.read()?.let{json.decodeFromString<HybridState>(it)} ?: HybridState();unlocked=true;identity=backend?.identity();render()}
    fun lock(){epoch++;task?.cancel();busy=false;unlocked=false;state=HybridState();identity=null;recovery="";profileName="";participation=false;pendingCount=0;conflicts=emptyList();cursor=null}
    private fun persist(){check(unlocked);storage.write(json.encodeToString(state));render()}
    private fun render(){pendingCount=state.pending.count{it.envelope.uid==identity?.uid};conflicts=state.conflicts.filter{state.bindings[it]?.uid==identity?.uid};recovery="";if(identity==null){profileName="";participation=false}}
    fun visible(records:List<ResearchRecord>)=if(!unlocked)emptyList() else records.filter{r -> state.bindings[r.id]?.uid.let{it==null || it==identity?.uid}}
    fun isBound(id:String)=state.bindings.containsKey(id)
    fun key(code:String?=null){
        val uid=identity?.uid ?: error("LOGIN_REQUIRED")
        require(state.pending.none{it.envelope.uid==uid} && state.bindings.values.none{it.uid==uid}){"KEY_ROTATION_REQUIRES_REVIEW"}
        val value=code?.trim()?.also{SyncCrypto.key(it)} ?: SyncCrypto.newKey()
        state=state.copy(keys=state.keys+(uid to value));persist();status="Kunci pemulihan tersimpan terlindungi di perangkat. Simpan salinan pribadi sebelum sinkronisasi."
    }
    fun revealKey(){recovery=state.keys[identity?.uid].orEmpty()}
    fun migrationPreview(records:List<ResearchRecord>)=records.filter{it.dataKind=="SYNTHETIC" && it.researchConsent && !isBound(it.id)}
    fun migrate(records:List<ResearchRecord>,confirmed:Boolean){
        val uid=identity?.takeIf{it.verified}?.uid ?: error("VERIFIED_LOGIN_REQUIRED")
        require(confirmed && state.keys.containsKey(uid));require(records.isNotEmpty() && records.size<=20)
        require(records.all{it.dataKind=="SYNTHETIC" && !isBound(it.id)})
        records.forEach{record -> state=state.copy(bindings=state.bindings+(record.id to Binding(uid)));changed(record)}
        persist();status="${records.size} catatan sintetis masuk antrean. Gambar tidak dikirim."
    }
    fun changed(record:ResearchRecord,tombstone:Boolean=false){
        if(!unlocked)return
        val binding=state.bindings[record.id] ?: return
        check(binding.uid==identity?.uid){"ACCOUNT_BOUND_RECORD"}
        val key=state.keys[binding.uid] ?: error("RECOVERY_KEY_REQUIRED")
        val envelope=SyncCrypto.seal(record,binding.uid,binding.revision+1,UUID.randomUUID().toString(),key,tombstone)
        state=state.copy(pending=state.pending.filterNot{it.recordId==record.id}+Pending(record.id,binding.revision,envelope));persist()
        status="Data tersimpan; menunggu sinkronisasi"
    }
    fun action(block:suspend (CloudBackend)->Unit){
        if(!unlocked || busy)return
        val backend=backend?.takeIf{it.configured} ?: run{status="Project riset Spark belum dikonfigurasi; fungsi lokal tetap tersedia.";return}
        val generation=epoch;busy=true
        task=scope.launch{
            try{withTimeout(30_000){block(backend)};if(generation==epoch){identity=backend.identity();render();onIdentityChanged()}}
            catch(_:CancellationException){if(generation==epoch)status="Operasi dibatalkan; data lokal dipertahankan."}
            catch(_:Exception){if(generation==epoch){retryAfter=System.currentTimeMillis()+60_000;status="Layanan/izin/kuota belum tersedia atau terjadi konflik. Antrean tetap terenkripsi; coba lagi setelah satu menit."}}
            finally{if(generation==epoch)busy=false}
        }
    }
    suspend fun signedIn(){identity=backend?.identity();profileName="";participation=false;if(identity?.verified==true){val data=backend!!.readProfile();profileName=data["displayName"] as? String ?: "";participation=data["participation"] as? Boolean ?: false};status="Akun terhubung. Verifikasi email, profil aktif dan kunci pemulihan diperlukan untuk sinkronisasi."}
    fun signOut(activity:Activity){action{it.signOut(activity);status="Keluar dari akun. Catatan akun tetap terenkripsi dan disembunyikan."}}
    fun sync(accept:(ResearchRecord,Boolean)->Unit){
        if(System.currentTimeMillis()<retryAfter){status="Menunggu jeda percobaan sinkronisasi; fungsi lokal tetap tersedia.";return}
        action{cloud ->
            cloud.refresh();val uid=cloud.identity()?.takeIf{it.verified}?.uid ?: error("VERIFIED_EMAIL_REQUIRED")
            val code=state.keys[uid] ?: error("RECOVERY_KEY_REQUIRED")
            for(item in state.pending.filter{it.envelope.uid==uid}.take(20)){
                try{cloud.push(item.envelope,item.base)}catch(e:Exception){
                    if(e.message.orEmpty().contains("REVISION_CONFLICT")){state=state.copy(conflicts=(state.conflicts+item.recordId).distinct());persist()};throw e
                }
                state=state.copy(pending=state.pending.filterNot{it.envelope.operationId==item.envelope.operationId},bindings=state.bindings+(item.recordId to Binding(uid,item.envelope.revision,item.envelope.hash)));persist()
            }
            val page=cloud.page(cursor)
            for(value in page.records){
                val pending=state.pending.any{it.recordId==value.recordId};val known=state.bindings[value.recordId]
                if(pending || (known!=null && known.uid!=uid)){state=state.copy(conflicts=(state.conflicts+value.recordId).distinct());continue}
                val record=SyncCrypto.open(value,uid,code)
                accept(record,value.tombstone)
                state=state.copy(bindings=state.bindings+(value.recordId to Binding(uid,value.revision,value.hash)))
            }
            cursor=page.cursor;persist();status="Sinkronisasi selesai untuk halaman ini. ${if(cursor!=null)"Masih ada halaman berikutnya." else ""}"
        }
    }
    fun reset(){lock();storage.delete()}
}
