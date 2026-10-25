package id.sonri.offline

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Matrix
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.ImageProxy
import androidx.camera.view.CameraController
import androidx.camera.view.LifecycleCameraController
import androidx.camera.view.PreviewView
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import id.sonri.offline.inference.ImagePipeline
import kotlinx.coroutines.*
import java.io.ByteArrayOutputStream

@Composable fun CameraScreen(vm: SonriViewModel) {
    if(!vm.consentReady()) { Text("Buat pemeriksaan dan berikan persetujuan riset sebelum mengakses kamera.");return }
    val context=LocalContext.current;val owner=LocalLifecycleOwner.current;val scope=rememberCoroutineScope()
    var permission by remember { mutableStateOf(ContextCompat.checkSelfPermission(context,Manifest.permission.CAMERA)==PackageManager.PERMISSION_GRANTED) }
    val request=rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { permission=it;if(!it)vm.notice("Izin kamera ditolak. Impor gambar lokal tetap tersedia.") }
    val controller=remember { LifecycleCameraController(context).apply {
        setEnabledUseCases(CameraController.IMAGE_CAPTURE)
        imageCaptureTargetSize=CameraController.OutputSize(android.util.Size(1280,960))
    } }
    DisposableEffect(permission,owner) {
        if(permission)try { controller.bindToLifecycle(owner) } catch(_:Exception) {vm.notice("Kamera tidak tersedia pada perangkat ini.")}
        onDispose { controller.unbind() }
    }
    Text("Capture hanya di RAM, tanpa JPEG sementara di cache. Orientasi sensor dikoreksi. Kamera bukan pemeriksa modalitas atau kelayakan klinis.")
    if(!permission)Button(onClick={request.launch(Manifest.permission.CAMERA)}){Text("Izinkan kamera (opsional)")}
    else {
        AndroidView(factory={PreviewView(it).apply {this.controller=controller}},modifier=Modifier.fillMaxWidth().height(320.dp))
        Button(onClick={
            val recordId=vm.current?.id
            controller.takePicture(ContextCompat.getMainExecutor(context),object:ImageCapture.OnImageCapturedCallback() {
                override fun onCaptureSuccess(frame: ImageProxy) {
                    scope.launch {
                        try {
                            val decoded=withContext(Dispatchers.Default) {
                                require(frame.width.toLong()*frame.height<=16_000_000)
                                val bitmap=frame.toBitmap();val rotated=android.graphics.Bitmap.createBitmap(bitmap,0,0,bitmap.width,bitmap.height,Matrix().apply{postRotate(frame.imageInfo.rotationDegrees.toFloat())},true)
                                val output=ByteArrayOutputStream();rotated.compress(android.graphics.Bitmap.CompressFormat.PNG,100,output)
                                ImagePipeline.decode(output.toByteArray())
                            }
                            vm.acceptImage(decoded,recordId)
                        } catch(_:Exception) {vm.notice("Capture tidak dapat diproses. Tidak ada gambar yang disimpan.")}
                        finally {frame.close()}
                    }
                }
                override fun onError(exception: ImageCaptureException) {vm.notice("Capture gagal; periksa kamera dan izin lokal.")}
            })
        },enabled=vm.consentReady() && !vm.busy && vm.current?.review==null,modifier=Modifier.fillMaxWidth()) {Text("Ambil gambar riset")}
    }
}
