package id.sonri.offline

import android.app.KeyguardManager
import android.content.Intent
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.compose.setContent
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import id.sonri.offline.data.Reports
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity: FragmentActivity() {
    private val vm: SonriViewModel by viewModels()
    private var afterUnlock: (() -> Unit)?=null
    private var modelPermission=""
    private var modelAcknowledged=false
    private var exportRecordId: String?=null
    private var closeConnectivity:(()->Unit)?=null
    private val authentication=registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if(result.resultCode==RESULT_OK) {
            vm.unlock();val action=afterUnlock;afterUnlock=null;if(vm.unlocked)action?.invoke()
        } else { afterUnlock=null;vm.notice("Workspace tetap terkunci.") }
    }
    private fun authorized(action: ()->Unit) {
        if(vm.unlocked)action() else { afterUnlock=action;unlock() }
    }
    @Suppress("DEPRECATION") private fun unlock() {
        if(!vm.disclaimerAccepted)return vm.notice("Setujui batasan riset terlebih dahulu.")
        val manager=getSystemService(KeyguardManager::class.java)
        if(!manager.isDeviceSecure)return vm.notice("Atur PIN/pola/kata sandi kunci layar Android terlebih dahulu. Kunci ini bukan verifikasi profesi.")
        val intent=manager.createConfirmDeviceCredentialIntent("Buka SONRI Riset","Otorisasi penyimpanan lokal perangkat")
        if(intent!=null)authentication.launch(intent) else vm.notice("Otorisasi perangkat tidak tersedia.")
    }
    private val imagePicker=registerForActivityResult(object: ActivityResultContracts.PickVisualMedia() {
        override fun createIntent(context: android.content.Context,input: PickVisualMediaRequest): Intent = super.createIntent(context,input).putExtra(Intent.EXTRA_LOCAL_ONLY,true)
    }) { uri ->
        if(uri!=null)authorized { vm.importImage(uri) }
    }
    private val modelPicker=registerForActivityResult(object: ActivityResultContracts.OpenDocument() {
        override fun createIntent(context: android.content.Context,input: Array<String>): Intent=super.createIntent(context,input).putExtra(Intent.EXTRA_LOCAL_ONLY,true)
    }) { uri ->
        val reference=modelPermission;val acknowledged=modelAcknowledged;modelPermission="";modelAcknowledged=false
        if(uri!=null)authorized { vm.importModel(uri,reference,acknowledged) }
    }
    private val jsonExport=registerForActivityResult(object: ActivityResultContracts.CreateDocument("application/json") {
        override fun createIntent(context: android.content.Context,input: String): Intent=super.createIntent(context,input).putExtra(Intent.EXTRA_LOCAL_ONLY,true)
    }) { uri ->
        if(uri!=null)authorized { export(uri,"json") }
    }
    private val pdfExport=registerForActivityResult(object: ActivityResultContracts.CreateDocument("application/pdf") {
        override fun createIntent(context: android.content.Context,input: String): Intent=super.createIntent(context,input).putExtra(Intent.EXTRA_LOCAL_ONLY,true)
    }) { uri ->
        if(uri!=null)authorized { export(uri,"pdf") }
    }
    private fun export(uri: android.net.Uri,format: String) {
        val record=vm.current?.takeIf { it.id==exportRecordId } ?: return vm.notice("Buka kembali catatan sebelum ekspor.")
        lifecycleScope.launch {
            try {
                withContext(Dispatchers.IO) {
                    contentResolver.openOutputStream(uri,"wt")?.use { stream ->
                        if(format=="json")stream.write(Reports.json(record).toByteArray()) else Reports.pdf(record,stream)
                    } ?: error("EXPORT_TARGET_UNAVAILABLE")
                }
                vm.notice("Laporan diekspor ke lokasi pilihan Anda. File tujuan tidak dienkripsi aplikasi.")
            } catch(_: Exception) { vm.notice("Ekspor gagal. Periksa lokasi tujuan; tidak ada unggahan aplikasi.") }
        }
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        closeConnectivity=vm.cloud.backend?.observeNetwork{online -> lifecycleScope.launch{vm.networkChanged(online)}}
        setContent {
            SonriApp(vm,::unlock,
                pickImage={ if(vm.consentReady())imagePicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                pickModel={
                    modelPermission=vm.pendingModelPermission;modelAcknowledged=vm.modelAcknowledged
                    modelPicker.launch(arrayOf("application/octet-stream","application/onnx","*/*"))
                },
                export={ format ->
                    try {
                        vm.save(false);exportRecordId=vm.current?.id
                        val name="sonri-riset-${exportRecordId?.take(8)}.$format"
                        if(format=="json")jsonExport.launch(name) else pdfExport.launch(name)
                    } catch(_: Exception) { vm.notice("Catatan belum memenuhi persetujuan/kontrak penyimpanan.") }
                },
                securitySettings={ startActivity(Intent(android.provider.Settings.ACTION_SECURITY_SETTINGS)) })
        }
    }
    override fun onStop() { vm.lock();super.onStop() }
    override fun onDestroy(){closeConnectivity?.invoke();super.onDestroy()}
}
