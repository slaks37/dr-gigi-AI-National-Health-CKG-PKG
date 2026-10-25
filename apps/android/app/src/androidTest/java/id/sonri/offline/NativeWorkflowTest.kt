package id.sonri.offline

import android.os.Build
import android.view.WindowManager
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ViewModelProvider
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test

class NativeWorkflowTest {
    @get:Rule val compose=createAndroidComposeRule<MainActivity>()
    @Test fun publicOfflineCatalogAndSecureWindowAreNative() {
        compose.onNodeWithText("Buka katalog offline").performScrollTo().performClick()
        compose.onNodeWithText("Cari kode atau istilah resmi").performTextInput("K02.9")
        compose.onNodeWithTag("term-K02.9").performScrollTo().assertIsDisplayed()
        assertTrue(compose.activity.window.attributes.flags and WindowManager.LayoutParams.FLAG_SECURE != 0)
    }
    @Test fun deniedCameraStillAllowsLocalFixtureWorkflow() {
        assumeTrue(Build.HARDWARE in setOf("ranchu","goldfish"))
        assumeTrue(compose.activity.checkSelfPermission(android.Manifest.permission.CAMERA)!=android.content.pm.PackageManager.PERMISSION_GRANTED)
        var vm:SonriViewModel?=null;var id=""
        try {
            compose.activityRule.scenario.onActivity { activity ->
                vm=ViewModelProvider(activity)[SonriViewModel::class.java]
                vm!!.apply { disclaimerAccepted=true;unlock();newRecord();id=current!!.id;update{it.copy(researchConsent=true)};screen=Screen.CAMERA }
            }
            compose.onNodeWithText("Izinkan kamera (opsional)").performScrollTo().assertIsDisplayed()
            compose.activityRule.scenario.onActivity { vm!!.screen=Screen.IMPORT }
            compose.onNodeWithTag("action-Buka fixture geometris sintetis").performScrollTo().performClick()
            compose.waitUntil(15_000){vm?.screen==Screen.QUALITY && vm?.busy==false}
            compose.activityRule.scenario.onActivity {assertNotNull(vm!!.image);assertNull(vm!!.current!!.ai)}
            // The public APK has no weights: acknowledge quality so model readiness is the remaining gate.
            compose.onNodeWithText("Saya memeriksa gambar dan memahami batas kualitas/modalitas untuk riset.").performScrollTo().performClick()
            var modelReady=false
            compose.activityRule.scenario.onActivity {modelReady=vm!!.modelReady()}
            compose.onNodeWithTag("analysis-model-status").performScrollTo().assertIsDisplayed()
            if(!modelReady){
                compose.onNodeWithTag("action-Jalankan AI lokal sebenarnya").performScrollTo().assertIsNotEnabled()
                compose.activityRule.scenario.onActivity {vm!!.analyze();assertNull(vm!!.current!!.ai)}
                compose.onNodeWithTag("analysis-status").performScrollTo().assertIsDisplayed()
                compose.onNodeWithTag("action-Impor model lokal untuk analisis").performScrollTo().performClick()
                compose.onNodeWithText("Perangkat dan model").performScrollTo().assertIsDisplayed()
                compose.onNodeWithTag("action-Impor ONNX lokal terverifikasi").performScrollTo().assertIsNotEnabled()
            }
        } finally {compose.activityRule.scenario.onActivity {vm?.delete(id);vm?.lock()}}
    }
    @Test fun syntheticOdontogramPersistsAndWorkspaceLocksWhenBackgrounded() {
        assumeTrue("Emulator-only UI fixture: host creates its own synthetic screen-lock PIN",Build.HARDWARE in setOf("ranchu","goldfish"))
        // This fixture enters the already OS-unlocked emulator workspace directly.
        // It does not claim to verify the system credential prompt or professional identity.
        compose.activityRule.scenario.onActivity { a -> ViewModelProvider(a)[SonriViewModel::class.java].apply {disclaimerAccepted=true;unlock()} }
        compose.onNodeWithText("Pemeriksaan riset baru").performScrollTo().performClick()
        compose.onNodeWithText("Saya memiliki izin memproses data riset ini secara lokal; tidak ada pasien nyata.").performScrollTo().performClick()
        compose.onNodeWithText("Pemeriksaan klinis terstruktur").performScrollTo().performClick()
        compose.onNodeWithTag("action-Odontogram FDI").performScrollTo().performClick()
        compose.onNodeWithTag("tooth-16").performScrollTo().performClick()
        compose.onNodeWithText("FINDING",useUnmergedTree=true).performScrollTo().performClick()
        compose.onNodeWithText("Observasi manual FDI 16").performTextInput("SYNTHETIC manual observation")
        compose.onNodeWithText("Kembali ke form").performScrollTo().performClick()
        compose.onNodeWithText("Simpan terenkripsi").performScrollTo().performClick()
        var id=""
        compose.activityRule.scenario.onActivity { a ->
            val vm=ViewModelProvider(a)[SonriViewModel::class.java]
            val record=vm.current!!;id=record.id
            assertEquals("FINDING",record.examination.teeth.single().status)
            assertEquals("SYNTHETIC manual observation",record.examination.teeth.single().observation)
            assertNull(record.review);assertNull(record.ai)
        }
        compose.activityRule.scenario.moveToState(Lifecycle.State.CREATED)
        compose.activityRule.scenario.moveToState(Lifecycle.State.RESUMED)
        compose.onNodeWithText("Buka workspace dengan kunci perangkat").performScrollTo().assertIsDisplayed()
        compose.activityRule.scenario.onActivity { a ->
            val vm=ViewModelProvider(a)[SonriViewModel::class.java]
            assertFalse(vm.unlocked);assertNull(vm.current);assertTrue(vm.records.isEmpty())
            vm.unlock();assertEquals(id,vm.records.single{it.id==id}.id);vm.delete(id)
        }
    }
}
