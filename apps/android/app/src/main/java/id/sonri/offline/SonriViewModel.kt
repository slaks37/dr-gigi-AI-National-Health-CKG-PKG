package id.sonri.offline

import android.app.Application
import android.app.KeyguardManager
import android.net.Uri
import androidx.compose.runtime.*
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import id.sonri.offline.core.*
import id.sonri.offline.data.LocalVault
import id.sonri.offline.inference.*
import kotlinx.coroutines.*

enum class Screen(val title: String) {
    WELCOME("Selamat datang"),WORKSPACE("Workspace offline"),SELECT_EXAM("Pilih pemeriksaan"),CAMERA("Kamera lokal"),IMPORT("Impor gambar"),
    QUALITY("Kualitas gambar"),ANALYSIS("Analisis AI lokal"),RESULTS("Hasil analisis awal"),EVIDENCE("Informasi model dan bukti"),EXAM("Form pemeriksaan"),
    ODONTOGRAM("Odontogram FDI"),TERMS("Katalog ICD-10 K00-K14"),DIFFERENTIAL("Banding dan bukti"),REVIEW("Review lokal"),HISTORY("Riwayat terenkripsi"),REPORT("Laporan dan ekspor"),DEVICE("Perangkat dan model"),PROFILE("Profil dan sinkronisasi"),UPDATES("Pembaruan aplikasi dan model")
}
class SonriViewModel(app: Application): AndroidViewModel(app) {
    val catalog: TerminologyBundle = app.assets.open("terminology.v1.json").use { input ->
        val bytes=input.readBytes();val expected=app.assets.open("terminology.v1.json.sha256").bufferedReader().use { it.readText() }
        Terminology.parse(bytes,expected)
    }
    private val vault=LocalVault(app)
    val model=LocalModel(app)
    private val engine=OnDeviceEngine()
    val cloud=id.sonri.offline.hybrid.HybridController(app,viewModelScope).apply{onIdentityChanged={refreshCloudVisibility()}}
    val updates=cloud.backend?.releaseConfig().let{config -> id.sonri.offline.hybrid.UpdateController(app,config?.first.orEmpty(),config?.second.orEmpty(),viewModelScope)}
    private var data=VaultData()
    private var selectedId: String?=null
    private var epoch=0
    private var task: Job?=null
    var screen by mutableStateOf(Screen.WELCOME)
    var unlocked by mutableStateOf(false);private set
    var disclaimerAccepted by mutableStateOf(false)
    var message by mutableStateOf("");private set
    var busy by mutableStateOf(false);private set
    var online by mutableStateOf(false);private set
    fun networkChanged(connected:Boolean){val was=online;online=connected;if(connected && !was && unlocked && cloud.pendingCount>0)syncCloud()}
    var status by mutableStateOf("");private set
    var records by mutableStateOf<List<ResearchRecord>>(emptyList());private set
    var current by mutableStateOf<ResearchRecord?>(null);private set
    var image by mutableStateOf<ResearchImage?>(null);private set
    var qualityAcknowledged by mutableStateOf(false)
    var modelPermission by mutableStateOf("");private set
    var modelAcknowledged by mutableStateOf(false)
    var pendingModelPermission by mutableStateOf("")
    var query by mutableStateOf("")
    var selectedTerm by mutableStateOf<Term?>(null)
    var reviewer by mutableStateOf("")
    var reviewEvidence by mutableStateOf("")
    var dentistAttested by mutableStateOf(false)
    fun notice(text: String) { message=text }
    fun unlock() {
        if(!disclaimerAccepted)return notice("Setujui batasan riset terlebih dahulu.")
        if(!getApplication<Application>().getSystemService(KeyguardManager::class.java).isDeviceSecure)return notice("Aktifkan kunci layar perangkat untuk membuka penyimpanan riset.")
        try {
            data=vault.prune(vault.load());vault.save(data)
            cloud.load();updates.load();records=cloud.visible(data.records);current=records.find { it.id==selectedId };modelPermission=data.modelPermissionReference
            unlocked=true;screen=Screen.WORKSPACE;message="Workspace lokal terbuka. Identitas profesi tidak diverifikasi."
        } catch(_: Exception) { notice("Penyimpanan tidak dapat dibuka. Data tidak ditimpa; periksa perangkat/kunci. Reset hanya jika rela kehilangan data lokal.") }
    }
    fun lock() {
        if(unlocked && current?.researchConsent==true)try { save(false) } catch(_: Exception) { /* keep old authenticated ciphertext intact */ }
        epoch++;engine.cancel();task?.cancel();cloud.lock();updates.lock();unlocked=false;busy=false;current=null;records=emptyList();image=null;data=VaultData();modelPermission=""
        reviewer="";reviewEvidence="";dentistAttested=false;pendingModelPermission="";modelAcknowledged=false;qualityAcknowledged=false;selectedTerm=null
    }
    fun newRecord() {
        if(!unlocked || busy || cloud.busy)return
        current=ResearchRecord();selectedId=current?.id;image=null;qualityAcknowledged=false;screen=Screen.SELECT_EXAM
    }
    fun update(change: (ResearchRecord)->ResearchRecord) {
        if(!unlocked || busy || cloud.busy)return
        val old=current ?: return
        if(old.review!=null)return notice("Catatan yang direview terkunci. Buka revisi dahulu.")
        current=change(old)
    }
    fun updateExam(change: (Examination)->Examination)=update { it.copy(examination=change(it.examination)) }
    fun save(announce: Boolean=true) {
        if(!unlocked)return
        val record=current ?: return
        DentalRules.validate(record)
        val stored=data.records.find { it.id==record.id }
        val saved=if(stored==record)record else DentalRules.changed(record,if(stored==null)"CREATE_RESEARCH_RECORD" else "SAVE_RESEARCH_RECORD")
        val next=data.copy(records=(data.records.filterNot { it.id==saved.id }+saved).sortedByDescending { it.updatedAt })
        vault.save(next);data=next;records=cloud.visible(next.records);current=saved;selectedId=saved.id
        if(stored!=record)cloud.changed(saved)
        if(announce)notice("Data tersimpan terenkripsi di perangkat ini. Status sinkronisasi riset dapat dilihat di Profil.")
    }
    fun open(record: ResearchRecord) { if(!unlocked || busy || cloud.busy)return;current=record;selectedId=record.id;image=null;selectedTerm=catalog.entries.find { it.code==record.candidateCode };screen=Screen.EXAM }
    fun delete(id: String) {
        if(!unlocked || busy || cloud.busy)return
        try {data.records.find{it.id==id}?.let{cloud.changed(it,true)}; val next=data.copy(records=data.records.filterNot { it.id==id });vault.save(next);data=next;records=cloud.visible(next.records);if(current?.id==id) { current=null;selectedId=null;image=null };notice("Catatan lokal dihapus. Catatan cloud memerlukan sinkronisasi; penghapusan seluruh revisi melalui operator.") }
        catch(_: Exception) { notice("Penghapusan gagal; data lama dipertahankan.") }
    }
    fun consentReady(): Boolean = unlocked && current?.let { it.researchConsent && (it.dataKind=="SYNTHETIC" || it.permissionReference.trim().length>=8) }==true
    fun modelReady():Boolean=model.file.isFile && model.file.length()==RFDETR_BYTES && modelPermission.trim().length>=8
    fun modelReadinessMessage():String=when {
        !model.file.isFile -> "AI belum siap: model lokal belum diimpor. Impor file ONNX berizin melalui Perangkat dan model."
        model.file.length()!=RFDETR_BYTES -> "AI belum siap: ukuran file model lokal tidak sesuai. Impor ulang model ONNX yang terverifikasi."
        modelPermission.trim().length<8 -> "AI belum siap: referensi izin pemakaian model belum tercatat. Lengkapi izin dan impor model melalui Perangkat dan model."
        else -> "Model lokal dan referensi izin tersedia. SHA-256 tetap diperiksa sebelum setiap analisis; kategori model belum terverifikasi."
    }
    private fun job(label: String,block: suspend (Int)->Unit) {
        if(!unlocked || busy || cloud.busy)return
        val generation=epoch;busy=true;status=label
        task=viewModelScope.launch {
            try { block(generation) }
            catch(_: CancellationException) { if(generation==epoch)notice("Operasi dibatalkan.") }
            catch(_: OutOfMemoryError) { if(generation==epoch)notice("Memori tidak cukup. Model/perangkat belum didukung; tidak ada hasil pengganti.") }
            catch(_: Exception) { if(generation==epoch)notice("Operasi lokal gagal. Periksa hash, format, izin, dan kompatibilitas perangkat. Tidak ada hasil AI yang dibuat.") }
            finally { if(generation==epoch) { busy=false;status="" } }
        }
    }
    fun acceptImage(decoded: ResearchImage,expectedRecordId: String?=current?.id) {
        if(busy || !consentReady() || current?.review!=null || current?.id!=expectedRecordId)return
        image=decoded;qualityAcknowledged=false
        update { it.copy(quality=decoded.quality,ai=it.ai?.takeIf { ai -> ai.imageSha256==decoded.sourceSha256 }) }
        screen=Screen.QUALITY
    }
    fun importImage(uri: Uri) {
        if(!consentReady())return notice("Persetujuan dan referensi izin data diperlukan.")
        job("Mendekode gambar lokal tanpa cache...") { generation ->
            val decoded=withContext(Dispatchers.Default) { ImagePipeline.fromUri(getApplication(),uri) }
            if(generation==epoch && unlocked) { busy=false;acceptImage(decoded) }
        }
    }
    fun syntheticImage() {
        if(!consentReady())return notice("Buat pemeriksaan dan setujui penggunaan fixture sintetis.")
        if(current?.dataKind!="SYNTHETIC")return notice("Pilih jenis data SINTETIS untuk fixture bawaan.")
        job("Membuka fixture geometris sintetis...") { generation ->
            val decoded=withContext(Dispatchers.Default) { getApplication<Application>().assets.open("research-fixture.png").use { ImagePipeline.decode(it.readBytes()) } }
            if(generation==epoch && unlocked) { busy=false;acceptImage(decoded) }
        }
    }
    fun importModel(uri: Uri,reference: String,acknowledged: Boolean) {
        job("Memeriksa ukuran dan SHA-256 model lokal...") { generation ->
            withContext(Dispatchers.IO) { model.import(getApplication(),uri,reference,acknowledged) }
            if(generation==epoch && unlocked) {
                val next=data.copy(modelPermissionReference=reference.trim());vault.save(next);data=next;modelPermission=reference.trim();notice("Model cocok dengan hash. Izin tercatat sebagai pernyataan pemilik, bukan verifikasi independen.")
            }
        }
    }
    fun analyze() {
        if(!unlocked)return notice("Buka workspace dengan kunci perangkat terlebih dahulu.")
        if(busy || cloud.busy)return notice("Operasi lain sedang berjalan. Tunggu hingga selesai sebelum menjalankan analisis lokal.")
        val source=image ?: return notice("Impor gambar terlebih dahulu.")
        val recordId=current?.id
        if(!consentReady() || !qualityAcknowledged || current?.review!=null)return notice("Persetujuan, pemeriksaan kualitas, dan catatan terbuka diperlukan.")
        if(!modelReady())return notice(modelReadinessMessage())
        screen=Screen.ANALYSIS
        job("Menjalankan model sebenarnya di CPU perangkat. Tidak ada request server.") { generation ->
            val result=withContext(Dispatchers.Default) { val hashMs=model.verify();engine.analyze(model.file,source,hashMs) }
            if(generation==epoch && unlocked && current?.id==recordId && image?.sourceSha256==source.sourceSha256) { busy=false;update { it.copy(ai=result.evidence) };save(false);screen=Screen.RESULTS;notice("Inferensi lokal selesai. Semua kelas mentah UNVERIFIED.") }
        }
    }
    fun cancel() { engine.cancel();task?.cancel() }
    fun choose(term: Term) { if(busy)return;selectedTerm=term;if(term.kind=="TERMINAL")update { it.copy(candidateCode=term.code) };screen=Screen.DIFFERENTIAL }
    fun confirm() {
        if(!unlocked || busy || cloud.busy)return
        try {
            val record=current ?: return;val term=catalog.entries.find { it.code==record.candidateCode } ?: return notice("Pilih kode terminal secara manual.")
            current=DentalRules.changed(DentalRules.confirm(record,term,reviewer,reviewEvidence,dentistAttested),"LOCAL_SELF_ATTESTED_REVIEW")
            save(false);notice("Review riset lokal tercatat. Identitas profesi dan validasi klinis tetap belum diverifikasi.");screen=Screen.REPORT
        } catch(_: Exception) { notice("Lengkapi orientasi, pemeriksaan wajib, bukti klinis, dan pernyataan peninjau.") }
    }
    fun reopen() { if(unlocked && !busy)current=current?.let { DentalRules.changed(it.copy(review=null),"REOPEN_LOCAL_REVIEW") } }
    fun reset() { cancel();lock();vault.deleteAll();cloud.reset();updates.reset();model.delete();selectedId=null;notice("Kunci, catatan terenkripsi, dan model lokal dihapus. Ekspor dan catatan cloud tidak ikut dihapus.") }
    fun retention(days: Int) { if(unlocked)try {
        // Persist the valid current draft before pruning so a later lock cannot restore an expired record.
        if(current?.researchConsent==true)save(false)
        val next=vault.prune(data.copy(retentionDays=days));vault.save(next);data=next;records=cloud.visible(next.records)
        if(current!=null && next.records.none{it.id==current?.id}) {current=null;selectedId=null;image=null}
        notice("Retensi lokal: $days hari. Catatan kedaluwarsa dihapus saat workspace dibuka.")
    } catch(_: Exception) { notice("Pengaturan retensi gagal.") } }
    private fun refreshCloudVisibility(){records=cloud.visible(data.records);if(current?.let{cloud.isBound(it.id) && it.id !in records.map{r->r.id}}==true){current=null;selectedId=null;image=null}}
    fun syncCloud(){
        if(!unlocked || busy || cloud.busy)return
        try{if(current?.researchConsent==true)save(false)}catch(_:Exception){return notice("Simpan draft yang valid terlebih dahulu.")}
        cloud.sync {record,deleted ->
            val old=data.records.find{it.id==record.id}
            require(old==null || cloud.isBound(record.id)){"LOCAL_ID_COLLISION"}
            require(old?.review==null || old==record){"LOCAL_REVIEW_CONFLICT"}
            val next=data.copy(records=(data.records.filterNot{it.id==record.id}+if(deleted)emptyList() else listOf(record)).sortedByDescending{it.updatedAt})
            vault.save(next);data=next;records=cloud.visible(next.records)
            if(current?.id==record.id){current=if(deleted)null else record;image=null}
        }
    }
    override fun onCleared() { engine.cancel();super.onCleared() }
}
