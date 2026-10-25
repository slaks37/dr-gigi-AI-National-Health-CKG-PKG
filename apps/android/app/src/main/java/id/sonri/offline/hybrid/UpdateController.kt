package id.sonri.offline.hybrid

import android.content.Context
import android.util.AtomicFile
import androidx.compose.runtime.*
import ai.onnxruntime.*
import id.sonri.offline.core.sha256
import kotlinx.coroutines.*
import kotlinx.serialization.json.Json
import java.io.File
import java.net.URL
import javax.net.ssl.HttpsURLConnection

class UpdateController(private val context:Context,private val origin:String,private val pinnedKey:String,private val scope:CoroutineScope,private val storageName:String="signed-update-state"){
    private val storage=ProtectedState(context,storageName)
    private val json=Json {encodeDefaults=true};private var state=UpdateState();private var task:Job?=null
    var status by mutableStateOf("Pembaruan belum dikonfigurasi oleh operator");private set
    var busy by mutableStateOf(false);private set
    var progress by mutableLongStateOf(0);private set
    var available by mutableStateOf<List<ModelRelease>>(emptyList());private set
    var appRelease by mutableStateOf<ApplicationRelease?>(null);private set
    var active by mutableStateOf<ModelRelease?>(null);private set
    fun appCompatible(release:ApplicationRelease):Boolean {
        @Suppress("DEPRECATION") val info=context.packageManager.getPackageInfo(context.packageName,android.content.pm.PackageManager.GET_SIGNING_CERTIFICATES)
        val certificate=info.signingInfo?.apkContentsSigners?.singleOrNull()?.toByteArray()?.let(::sha256) ?: return false
        return SignedUpdates.compatibleApp(release,info.longVersionCode,context.packageName,certificate)
    }
    private fun display(){available=state.manifest?.models.orEmpty();appRelease=state.manifest?.application;active=state.active}
    fun load(){state=storage.read()?.let{json.decodeFromString<UpdateState>(it)} ?: UpdateState();display()}
    fun lock(){cancel();state=UpdateState();available=emptyList();appRelease=null;active=null}
    fun cancel(){task?.cancel()}
    private fun save(){storage.write(json.encodeToString(state));display()}
    private fun action(block:suspend()->Unit){if(busy)return;busy=true;task=scope.launch{
        try{withTimeout(60_000){block()}}catch(_:CancellationException){status="Pembaruan dibatalkan; versi aktif dipertahankan."}
        catch(_:Exception){status="Pembaruan ditolak atau jaringan tidak tersedia; versi aktif tidak diganti."}finally{busy=false}
    }}
    private suspend fun fetch(path:String,max:Long,consume:suspend(ByteArray,Int)->Unit){
        require(origin.startsWith("https://") && pinnedKey.isNotBlank())
        withContext(Dispatchers.IO){
            val connection=URL(origin.trimEnd('/')+path).openConnection() as HttpsURLConnection
            connection.instanceFollowRedirects=false;connection.connectTimeout=10_000;connection.readTimeout=10_000
            try{require(connection.responseCode==200);connection.inputStream.use{input ->
                val buffer=ByteArray(65536);var count=0L
                while(true){currentCoroutineContext().ensureActive();val n=input.read(buffer);if(n<0)break;count+=n;require(count<=max);consume(buffer,n)}
            }}finally{connection.disconnect()}
        }
    }
    fun check(){action{
        val output=java.io.ByteArrayOutputStream();fetch("/manifest.json",32000){b,n->output.write(b,0,n)}
        val (manifest,hash)=SignedUpdates.verify(output.toByteArray(),pinnedKey,origin,state)
        state=state.copy(sequence=manifest.sequence,floor=manifest.minimumSafeVersion,payloadHash=hash,manifest=manifest);save()
        status="Metadata bertanda tangan terverifikasi. Hanya artefak uji perangkat lunak; bobot dental tidak didistribusikan."
    }}
    private fun file(v:ModelRelease)=File(context.noBackupFilesDir,"$storageName-synthetic-${v.version}-${v.sha256}.onnx")
    fun reset(){cancel();storage.delete();context.noBackupFilesDir.listFiles()?.filter{it.name.startsWith("$storageName-synthetic-")}?.forEach{it.delete()};state=UpdateState();display()}
    fun install(release:ModelRelease){action{
        require(release in state.manifest!!.models && release.version>=state.floor)
        val atomic=AtomicFile(file(release));val candidate=File(file(release).path+".download");progress=0
        try{
            candidate.outputStream().use{stream -> fetch(release.path,release.bytes){bytes,n -> stream.write(bytes,0,n);progress+=n};stream.fd.sync()}
            require(progress==release.bytes)
            require(candidate.isFile && sha256(candidate.readBytes())==release.sha256)
            testKernel(candidate)
            val stream=atomic.startWrite()
            try{candidate.inputStream().use{it.copyTo(stream)};atomic.finishWrite(stream)}catch(e:Exception){atomic.failWrite(stream);throw e}
        }finally{candidate.delete()}
        state=state.copy(previous=state.active,active=release);save();status="Artefak sintetis aktif. RF-DETR lokal tetap terpisah dan tidak berubah."
    }}
    fun rollback(){action{
        val previous=state.previous ?: error("NO_PREVIOUS_VERSION")
        require(previous.version>=state.floor && previous in state.manifest!!.models && sha256(file(previous).readBytes())==previous.sha256)
        testKernel(file(previous));state=state.copy(active=previous,previous=state.active);save();status="Kembali ke versi sintetis kompatibel yang masih diizinkan."
    }}
    fun runOffline(){action{val release=state.active ?: error("NO_ACTIVE_ARTIFACT");require(release.version>=state.floor && sha256(file(release).readBytes())==release.sha256);withContext(Dispatchers.Default){testKernel(file(release))};status="Eksekusi ONNX sintetis offline berhasil: [5, 7, 9]. Bukan model dental."}}
    private fun testKernel(file:File){OrtEnvironment.getEnvironment().createSession(file.path).use{session ->
        require(session.inputNames==setOf("x") && session.outputNames==setOf("y"))
        OnnxTensor.createTensor(OrtEnvironment.getEnvironment(),arrayOf(floatArrayOf(2f,3f,4f))).use{input -> session.run(mapOf("x" to input)).use{result ->
            val values=(result[0].value as Array<*>)[0] as FloatArray;require(values.contentEquals(floatArrayOf(5f,7f,9f)))
        }}
    }}
}
