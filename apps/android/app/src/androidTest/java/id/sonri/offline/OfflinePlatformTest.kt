package id.sonri.offline

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.os.Bundle
import android.provider.Settings
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import ai.onnxruntime.*
import id.sonri.offline.core.*
import id.sonri.offline.data.*
import id.sonri.offline.inference.*
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.zip.GZIPInputStream
import kotlin.math.abs

@RunWith(AndroidJUnit4::class)
class OfflinePlatformTest {
    private val instrumentation=InstrumentationRegistry.getInstrumentation()
    private val context=instrumentation.targetContext
    @Test fun coreManifestHasNoNetworkStorageOrAudioPermission() {
        @Suppress("DEPRECATION") val permissions=context.packageManager.getPackageInfo(context.packageName,PackageManager.GET_PERMISSIONS).requestedPermissions.orEmpty()
        assertEquals(BuildConfig.NETWORK_ENABLED,Manifest.permission.INTERNET in permissions)
        assertFalse(Manifest.permission.READ_EXTERNAL_STORAGE in permissions)
        assertFalse(Manifest.permission.RECORD_AUDIO in permissions)
        assertEquals(0,context.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_ALLOW_BACKUP)
    }
    @Test fun airplaneModeCatalogAndActualNativeKernelWorkOffline() {
        assertEquals("Airplane mode must be enabled by the emulator test host",1,Settings.Global.getInt(context.contentResolver,Settings.Global.AIRPLANE_MODE_ON,0))
        val bytes=context.assets.open("terminology.v1.json").use { it.readBytes() }
        val expected=context.assets.open("terminology.v1.json.sha256").bufferedReader().use {it.readText()}
        assertEquals(108,Terminology.parse(bytes,expected).entries.count{it.kind=="TERMINAL"})
        val model=instrumentation.context.assets.open("software-arithmetic.onnx.bin").use{it.readBytes()}
        val env=OrtEnvironment.getEnvironment()
        env.createSession(model).use { session ->
            OnnxTensor.createTensor(env,arrayOf(floatArrayOf(2f,3f,4f))).use { input ->
                session.run(mapOf("x" to input)).use { result ->
                    val actual=(result[0].value as Array<*>)[0] as FloatArray
                    assertArrayEquals(floatArrayOf(5f,7f,9f),actual,0f)
                }
            }
        }
        instrumentation.sendStatus(0,Bundle().apply{putString("sonri_scope","ACTUAL_NATIVE_ARITHMETIC_SOFTWARE_TEST_ONLY_NOT_DENTAL_AI")})
    }
    @Test fun actualPngDecodeAndFullResizeTensorMatchDesktop() {
        val bytes=instrumentation.context.assets.open("resize-fixture.png").use{it.readBytes()}
        val image=ImagePipeline.decode(bytes);assertEquals(315,image.bitmap.width);assertEquals(123,image.bitmap.height)
        val pixels=IntArray(315*123);image.bitmap.getPixels(pixels,0,315,0,0,315,123)
        val actual=DetrMath.preprocess(pixels,315,123)
        val reference=GZIPInputStream(instrumentation.context.assets.open("resize-reference.f32.fixture")).use{it.readBytes()}
        val expected=ByteBuffer.wrap(reference).order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer()
        assertEquals(actual.capacity(),expected.capacity());var difference=0f
        for(i in 0 until expected.capacity())difference=maxOf(difference,abs(expected[i]-actual[i]))
        assertTrue("Full NCHW preprocessing max absolute difference: $difference",difference<=2e-6f)
    }
    @Test fun exifOrientationSixRotatesRealJpegPixelsClockwise() {
        val image=instrumentation.context.assets.open("orientation-6.jpg").use{ImagePipeline.decode(it.readBytes())}
        assertEquals(80,image.bitmap.width);assertEquals(120,image.bitmap.height)
        val topLeft=image.bitmap.getPixel(20,30);val topRight=image.bitmap.getPixel(60,30)
        assertTrue(android.graphics.Color.blue(topLeft)>240 && android.graphics.Color.red(topLeft)<15)
        assertTrue(android.graphics.Color.red(topRight)>240 && android.graphics.Color.blue(topRight)<15)
    }
    @Test fun keystoreCiphertextTamperAndDeletionHaveRealPlatformEvidence() {
        val vault=LocalVault(context,"sonri.offline.records.test")
        try {
            vault.deleteAll()
            val record=ResearchRecord(alias="SYNTHETIC_PRIVATE_SENTINEL_7364",researchConsent=true)
            val data=VaultData(records=listOf(record));vault.save(data)
            assertEquals(record.id,vault.load().records.single().id)
            assertFalse(vault.file.readBytes().toString(Charsets.ISO_8859_1).contains(record.alias))
            val changed=vault.file.readBytes();changed[changed.lastIndex]=(changed.last().toInt() xor 1).toByte();vault.file.writeBytes(changed)
            try { vault.load();fail("Tampered ciphertext must not load") }catch(_:javax.crypto.AEADBadTagException) { }
            vault.deleteAll();assertFalse(vault.file.exists());assertTrue(vault.load().records.isEmpty())
        } finally {vault.deleteAll()}
    }
    @Test fun decodedImagesStayOutOfAppCacheAndPdfIsAnExplicitOutputStream() {
        val cacheBefore=context.cacheDir.walkTopDown().filter{it.isFile}.map{it.relativeTo(context.cacheDir).path}.toSet()
        context.assets.open("research-fixture.png").use{ImagePipeline.decode(it.readBytes())}
        val after=context.cacheDir.walkTopDown().filter{it.isFile}.map{it.relativeTo(context.cacheDir).path}.toSet()
        assertEquals(cacheBefore,after)
        val output=ByteArrayOutputStream();Reports.pdf(ResearchRecord(researchConsent=true),output)
        assertTrue(output.toByteArray().take(5).toByteArray().toString(Charsets.US_ASCII).startsWith("%PDF-"))
    }
    @Test fun wrongModelBytesAreRejectedBeforeOrt() {
        val candidate=java.io.File(context.noBackupFilesDir,"wrong-model-test.bin")
        try {candidate.writeBytes(byteArrayOf(1,2,3));assertThrows(IllegalArgumentException::class.java){LocalModel(context).verify(candidate)}}
        finally{candidate.delete()}
    }
}
