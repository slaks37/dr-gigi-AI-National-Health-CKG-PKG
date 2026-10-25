package id.sonri.offline.inference

import android.content.Context
import android.net.Uri
import android.util.AtomicFile
import id.sonri.offline.core.*
import java.io.File
import java.security.MessageDigest

class LocalModel(context: Context) {
    val file=File(context.noBackupFilesDir,"research-rfdetr.onnx")
    fun verify(candidate: File=file): Double {
        val start=System.nanoTime()
        require(candidate.isFile && candidate.length()==RFDETR_BYTES) { "MODEL_SIZE_MISMATCH" }
        val md=MessageDigest.getInstance("SHA-256")
        candidate.inputStream().use { input -> val buffer=ByteArray(1024*1024);while(true) { val n=input.read(buffer);if(n<0)break;md.update(buffer,0,n) } }
        require(md.digest().joinToString("") { "%02x".format(it) }==RFDETR_SHA256) { "MODEL_SHA256_MISMATCH" }
        return (System.nanoTime()-start)/1e6
    }
    fun import(context: Context,uri: Uri,permissionReference: String,ownerAcknowledged: Boolean) {
        require(ownerAcknowledged && permissionReference.trim().length in 8..300) { "MODEL_PERMISSION_REFERENCE_REQUIRED" }
        val atomic=AtomicFile(file);val target=atomic.startWrite();val digest=MessageDigest.getInstance("SHA-256");var size=0L
        try {
            context.contentResolver.openInputStream(uri)?.use { input ->
                val buffer=ByteArray(1024*1024)
                while(true) { val n=input.read(buffer);if(n<0)break;size+=n;require(size<=RFDETR_BYTES) { "MODEL_SIZE_MISMATCH" };target.write(buffer,0,n);digest.update(buffer,0,n) }
            } ?: error("MODEL_FILE_UNAVAILABLE")
            require(size==RFDETR_BYTES && digest.digest().joinToString("") { "%02x".format(it) }==RFDETR_SHA256) { "MODEL_SHA256_MISMATCH" }
            atomic.finishWrite(target)
        } catch(error: Exception) { atomic.failWrite(target);throw error }
    }
    fun delete()=AtomicFile(file).delete()
}
