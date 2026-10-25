package id.sonri.offline

import androidx.test.platform.app.InstrumentationRegistry
import id.sonri.offline.hybrid.*
import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.security.KeyStore
import java.security.cert.CertificateFactory
import javax.net.ssl.*
import java.net.URL

class SignedDeliveryTest {
    @Test fun actualLocalHttpsSignedDownloadActivationOfflineRunFailureRecoveryAndRevocation()=runBlocking {
        assumeTrue(BuildConfig.USE_EMULATORS)
        assumeTrue(android.os.Build.HARDWARE in setOf("ranchu","goldfish"))
        val instrumentation=InstrumentationRegistry.getInstrumentation();val assets=instrumentation.context.assets
        val cert=assets.open("generated/certificate.pem").use{CertificateFactory.getInstance("X.509").generateCertificate(it)}
        val store=KeyStore.getInstance(KeyStore.getDefaultType()).apply{load(null);setCertificateEntry("synthetic-local-test",cert)}
        val manager=TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm()).apply{init(store)}
        val ssl=SSLContext.getInstance("TLS").apply{init(null,manager.trustManagers,null)}
        val previous=HttpsURLConnection.getDefaultSSLSocketFactory();HttpsURLConnection.setDefaultSSLSocketFactory(ssl.socketFactory)
        val scope=CoroutineScope(SupervisorJob()+Dispatchers.Main)
        val public=assets.open("generated/public-key.txt").bufferedReader().use{it.readText()}
        val update=UpdateController(instrumentation.targetContext,"https://10.0.2.2:8443",public,scope,"synthetic-update-test")
        suspend fun complete(){withTimeout(30_000){while(update.busy)delay(50)}}
        try{
            URL("https://10.0.2.2:8443/reset").readText()
            update.reset();update.load();update.check();complete();assertEquals(4,update.available.size)
            update.install(update.available.single{it.version==1});complete();assertEquals(1,update.active?.version)
            update.install(update.available.single{it.version==2});complete();assertEquals(2,update.active?.version)
            update.install(update.available.single{it.version==3});complete();assertEquals(2,update.active?.version)
            update.install(update.available.single{it.version==4});complete();assertEquals(2,update.active?.version)
            update.rollback();complete();assertEquals(1,update.active?.version)
            update.rollback();complete();assertEquals(2,update.active?.version)
            fun command(value:String){android.os.ParcelFileDescriptor.AutoCloseInputStream(instrumentation.uiAutomation.executeShellCommand(value)).use{it.readBytes()}}
            command("settings put global airplane_mode_on 1");command("svc wifi disable");command("svc data disable")
            update.runOffline();complete();assertTrue(update.status.contains("berhasil"))
            command("settings put global airplane_mode_on 0");command("svc wifi enable");command("svc data enable")
            var reconnected=false
            repeat(20){if(!reconnected){try{URL("https://10.0.2.2:8443/revoke").readText();reconnected=true}catch(_:Exception){delay(500)}}}
            assertTrue("Emulator network must actually return",reconnected);update.check();complete()
            update.rollback();complete();assertEquals(2,update.active?.version)
            assertTrue(update.status.contains("ditolak"))
        }finally{update.reset();scope.cancel();HttpsURLConnection.setDefaultSSLSocketFactory(previous)}
        instrumentation.sendStatus(0,android.os.Bundle().apply{putString("sonri_scope","ACTUAL_LOCAL_HTTPS_SYNTHETIC_SIGNED_UPDATE_NOT_CLOUDFLARE_HOSTED_OR_DENTAL_MODEL")})
    }
}
