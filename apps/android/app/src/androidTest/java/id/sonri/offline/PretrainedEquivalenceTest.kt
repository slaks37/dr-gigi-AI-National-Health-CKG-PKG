package id.sonri.offline

import android.app.ActivityManager
import android.content.Intent
import android.content.IntentFilter
import android.os.*
import android.provider.Settings
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.lifecycle.ViewModelProvider
import id.sonri.offline.core.*
import id.sonri.offline.inference.*
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.Rule
import org.junit.runner.RunWith
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import kotlin.math.abs
import kotlin.math.ceil

@RunWith(AndroidJUnit4::class)
class PretrainedEquivalenceTest {
    @get:Rule val compose=createAndroidComposeRule<MainActivity>()
    @Test fun syntheticNativeWorkflowDisplaysActualPretrainedBoxes() {
        val args=InstrumentationRegistry.getArguments()
        assumeTrue("Private checkpoint absent from public APK/CI",args.getString("pretrained")=="true")
        assumeTrue("Synthetic UI fixture on isolated emulator only",Build.HARDWARE in setOf("ranchu","goldfish"))
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        val source=File(context.noBackupFilesDir,"android-test-rfdetr.onnx")
        var vm:SonriViewModel?=null;var recordId="";var hadModel=false
        try {
            compose.activityRule.scenario.onActivity { activity ->
                vm=ViewModelProvider(activity)[SonriViewModel::class.java]
                vm!!.apply {
                    disclaimerAccepted=true;unlock();hadModel=model.file.exists()
                    importModel(android.net.Uri.fromFile(source),args.getString("permissionReference")!!,true)
                }
            }
            compose.waitUntil(30_000){vm?.busy==false}
            compose.activityRule.scenario.onActivity {
                assertEquals(args.getString("permissionReference"),vm!!.modelPermission)
                vm!!.newRecord();recordId=vm!!.current!!.id
            }
            compose.onNodeWithText("Saya memiliki izin memproses data riset ini secara lokal; tidak ada pasien nyata.").performScrollTo().performClick()
            compose.onNodeWithTag("action-Impor gambar / fixture").performScrollTo().performClick()
            compose.onNodeWithTag("action-Buka fixture geometris sintetis").performScrollTo().performClick()
            compose.waitUntil(15_000){vm?.screen==Screen.QUALITY && vm?.busy==false}
            compose.onNodeWithText("Saya memeriksa gambar dan memahami batas kualitas/modalitas untuk riset.").performScrollTo().performClick()
            compose.onNodeWithTag("action-Jalankan AI lokal sebenarnya").performScrollTo().performClick()
            compose.waitUntil(180_000){vm?.busy==false}
            compose.activityRule.scenario.onActivity {
                assertEquals(Screen.RESULTS,vm!!.screen)
                assertEquals(12,vm!!.current!!.ai!!.findings.size)
                assertNull(vm!!.current!!.review);assertEquals("",vm!!.current!!.candidateCode)
            }
            compose.onNodeWithTag("bounding-boxes").performScrollTo().assertIsDisplayed()
            compose.onNodeWithText("12 area ditandai • kategori belum terverifikasi").performScrollTo().assertIsDisplayed()
        } finally {
            compose.activityRule.scenario.onActivity {vm?.delete(recordId);if(!hadModel)vm?.model?.delete();vm?.lock()}
        }
    }
    @Test fun exactOwnerLocalPretrainedRunsOnAndroidWithNumericalEvidence() {
        val args=InstrumentationRegistry.getArguments()
        assumeTrue("Private SONRI checkpoint deliberately absent from public CI/APK",args.getString("pretrained")=="true")
        require(args.getString("permissionReference").orEmpty().length>=8) {"LOCAL_RESEARCH_PERMISSION_REFERENCE_REQUIRED"}
        val instrumentation=InstrumentationRegistry.getInstrumentation();val context=instrumentation.targetContext
        val model=File(context.noBackupFilesDir,"android-test-rfdetr.onnx")
        LocalModel(context).verify(model)
        assertEquals(1,Settings.Global.getInt(context.contentResolver,Settings.Global.AIRPLANE_MODE_ON,0))
        val golden=Json.parseToJsonElement(instrumentation.context.assets.open("rfdetr-reference.json").bufferedReader().use{it.readText()}).jsonObject
        assertEquals(RFDETR_SHA256,golden.getValue("model_sha256").jsonPrimitive.content)
        val engine=OnDeviceEngine();val runs=mutableListOf<InferenceEvidence>();val comparisons=mutableListOf<JsonObject>()
        val maxPss=AtomicLong(0);val sampling=AtomicBoolean(true)
        val sampler=Thread {while(sampling.get()){maxPss.accumulateAndGet(Debug.getPss(),::maxOf);Thread.sleep(100)}}.apply{isDaemon=true;start()}
        fun battery()=context.registerReceiver(null,IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val beforeBattery=battery();val thermalBefore=context.getSystemService(PowerManager::class.java).currentThermalStatus
        try {
            golden.getValue("fixtures").jsonArray.forEach { value ->
                val fixture=value.jsonObject;val name=fixture.getValue("fixture").jsonPrimitive.content
                val bytes=if(name=="research-fixture.png")context.assets.open(name).use{it.readBytes()} else instrumentation.context.assets.open(name).use{it.readBytes()}
                val image=ImagePipeline.decode(bytes);assertEquals(fixture.getValue("fixture_sha256").jsonPrimitive.content,image.sourceSha256)
                val actual=engine.analyze(model,image,LocalModel(context).verify(model));runs+=actual.evidence
                fun maxError(key: String,values: FloatArray): Float {val expected=fixture.getValue(key).jsonArray;assertEquals(expected.size,values.size);return values.indices.maxOf{abs(values[it]-expected[it].jsonPrimitive.float)}}
                val boxDiff=maxError("boxes",actual.boxes);val logitDiff=maxError("logits",actual.logits)
                assertTrue("Raw box difference $boxDiff",boxDiff<=1e-4f);assertTrue("Raw logit difference $logitDiff",logitDiff<=1e-3f)
                val expectedFindings=fixture.getValue("findings").jsonArray
                assertEquals(expectedFindings.size,actual.evidence.findings.size)
                expectedFindings.zip(actual.evidence.findings).forEach { (expected,found) -> assertEquals(expected.jsonObject.getValue("class_id").jsonPrimitive.int,found.classId) }
                comparisons+=buildJsonObject{put("fixture",name);put("image_sha256",image.sourceSha256);put("boxes_max_abs",boxDiff);put("logits_max_abs",logitDiff);put("raw_class_indices_equal",true);put("findings",actual.evidence.findings.size)}
            }
            val image=context.assets.open("research-fixture.png").use{ImagePipeline.decode(it.readBytes())}
            val repeats=args.getString("iterations")?.toIntOrNull()?.coerceIn(3,20) ?: 5
            repeat(repeats){runs+=engine.analyze(model,image,LocalModel(context).verify(model)).evidence}
        } finally {sampling.set(false);sampler.join(2000)}
        val latency=runs.drop(2).map{it.inferenceMs}.sorted();val total=runs.drop(2).map{it.totalMs}.sorted()
        fun percentile(values:List<Double>,p:Double)=values[(ceil(values.size*p).toInt()-1).coerceAtLeast(0)]
        val memory=ActivityManager.MemoryInfo().also{context.getSystemService(ActivityManager::class.java).getMemoryInfo(it)}
        val afterBattery=battery()
        val emulator=Build.FINGERPRINT.contains("generic") || Build.MODEL.contains("sdk",true) || Build.PRODUCT.contains("sdk",true) || Build.HARDWARE in setOf("ranchu","goldfish")
        val report=buildJsonObject {
            put("schema_version","sonri.android-pretrained-execution.v1");put("status","ACTUAL_PRETRAINED_ANDROID_EXECUTION")
            put("hardware_scope",if(emulator)"ANDROID_EMULATOR" else "PHYSICAL_ANDROID_DEVICE");put("physical_phone_tested",!emulator)
            put("manufacturer",Build.MANUFACTURER);put("model",Build.MODEL);put("android_api",Build.VERSION.SDK_INT);put("abi",Build.SUPPORTED_ABIS.first())
            put("ram_os_bytes",memory.totalMem);put("peak_sampled_process_pss_kib",maxPss.get());put("memory_sampling_ms",100)
            put("model_sha256",RFDETR_SHA256);put("model_bytes",model.length());put("provider","CPUExecutionProvider");put("threads",2)
            put("airplane_mode_observed",true);put("internet_permission",BuildConfig.NETWORK_ENABLED);put("model_modified",false);put("quantized",false)
            put("iterations",latency.size);put("inference_p50_ms",percentile(latency,.5));put("inference_p95_ms",percentile(latency,.95))
            put("total_p50_ms",percentile(total,.5));put("total_p95_ms",percentile(total,.95));put("load_first_ms",runs.first().loadMs)
            put("battery_temperature_before_deci_c",beforeBattery?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE,-1) ?: -1)
            put("battery_temperature_after_deci_c",afterBattery?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE,-1) ?: -1)
            put("thermal_status_before",thermalBefore);put("thermal_status_after",context.getSystemService(PowerManager::class.java).currentThermalStatus)
            put("battery_temperature_is_physical_measurement",!emulator);put("battery_drain_benchmark","NOT_ESTABLISHED_SHORT_SYNTHETIC_RUN")
            put("clinical_use",CLINICAL_USE);put("label_verification","UNVERIFIED");put("clinical_validation",false)
            put("android_redistribution_rights","NOT_INDEPENDENTLY_VERIFIED");put("comparisons",JsonArray(comparisons))
            put("limitations","Emulator timings do not establish physical-phone latency, battery, temperature or 4/6/8GB support. PSS is sampled, not a guaranteed absolute peak. Each analysis rehashes/reloads/closes the session; total excludes prior image import/decode and display. No weight optimization or clinical accuracy measured.")
        }
        File(context.filesDir,"synthetic-benchmark-evidence.json").writeText(report.toString())
        instrumentation.sendStatus(0,Bundle().apply{putString("sonri_pretrained_status","ACTUAL_ANDROID_EXECUTION")})
    }
}
