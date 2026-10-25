package id.sonri.offline.inference

import android.content.Context
import android.graphics.Bitmap
import android.graphics.ColorSpace
import android.graphics.ImageDecoder
import android.net.Uri
import id.sonri.offline.core.*
import java.io.InputStream
import java.nio.ByteBuffer

data class ResearchImage(val bitmap: Bitmap,val sourceSha256: String,val quality: Quality)
object ImagePipeline {
    const val MAX_BYTES=25_000_000
    fun readBounded(input: InputStream): ByteArray {
        val out=java.io.ByteArrayOutputStream();val buffer=ByteArray(65536);var total=0
        while(true) { val count=input.read(buffer);if(count<0)break;total+=count;require(total<=MAX_BYTES) { "IMAGE_TOO_LARGE" };out.write(buffer,0,count) }
        require(total>0) { "EMPTY_IMAGE" };return out.toByteArray()
    }
    fun fromUri(context: Context,uri: Uri): ResearchImage = context.contentResolver.openInputStream(uri)?.use { decode(readBounded(it)) } ?: error("IMAGE_UNAVAILABLE")
    fun decode(bytes: ByteArray): ResearchImage {
        require(bytes.size<=MAX_BYTES)
        val bitmap=ImageDecoder.decodeBitmap(ImageDecoder.createSource(ByteBuffer.wrap(bytes))) { decoder,info,_ ->
            require(info.size.width.toLong()*info.size.height<=16_000_000 && info.size.width>0 && info.size.height>0) { "IMAGE_PIXEL_LIMIT" }
            decoder.allocator=ImageDecoder.ALLOCATOR_SOFTWARE
            decoder.setTargetColorSpace(ColorSpace.get(ColorSpace.Named.SRGB))
        }
        val pixels=IntArray(bitmap.width*bitmap.height);bitmap.getPixels(pixels,0,bitmap.width,0,0,bitmap.width,bitmap.height)
        require(pixels.all { (it ushr 24)==255 }) { "TRANSPARENT_IMAGE_UNSUPPORTED" }
        val quality=DetrMath.quality(pixels,bitmap.width,bitmap.height)
        return ResearchImage(bitmap,sha256(bytes),quality)
    }
}
