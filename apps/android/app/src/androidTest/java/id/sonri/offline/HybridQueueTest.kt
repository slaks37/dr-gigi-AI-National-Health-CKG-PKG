package id.sonri.offline

import android.app.Activity
import androidx.test.platform.app.InstrumentationRegistry
import id.sonri.offline.core.*
import id.sonri.offline.hybrid.*
import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Test

/** Real Keystore/outbox persistence, MOCK backend identity; no hosted service claim. */
class HybridQueueTest {
    private class FakeAccount(var uid:String):CloudBackend {
        override val configured=true
        override fun identity()=CloudIdentity(uid,"synthetic@example.test",true)
        override suspend fun register(email:String,password:String){}
        override suspend fun login(email:String,password:String){}
        override suspend fun google(activity:Activity){}
        override suspend fun refresh(){}
        override suspend fun verifyEmail(){}
        override suspend fun resetPassword(email:String){}
        override suspend fun signOut(activity:Activity){}
        override suspend fun profile(name:String,participation:Boolean)=emptyMap<String,Any>()
        override suspend fun readProfile()=emptyMap<String,Any>()
        override suspend fun requestDeletion(){}
        override suspend fun push(value:CloudEnvelope,expected:Long){error("OFFLINE_MOCK")}
        var nextCursor:String?=null
        override suspend fun page(cursor:String?)=CloudPage(emptyList(),nextCursor)
    }
    @Test fun explicitMigrationPersistsEncryptedQueueAndKeepsAccountsSeparate(){
        val context=InstrumentationRegistry.getInstrumentation().targetContext;val scope=CoroutineScope(SupervisorJob()+Dispatchers.Main)
        val backend=FakeAccount("synthetic-A")
        val cloud=HybridController(context,scope,backend,"test-sync-state")
        val record=ResearchRecord(researchConsent=true,alias="SYNTHETIC_QUEUE_PRIVATE_SENTINEL")
        try{
            cloud.reset();cloud.load()
            assertThrows(Exception::class.java){cloud.migrate(listOf(record),true)}
            cloud.key();assertThrows(Exception::class.java){cloud.migrate(listOf(record),false)}
            cloud.migrate(listOf(record),true);cloud.changed(record.copy(alias="SYNTHETIC newer offline edit"));assertEquals(1,cloud.pendingCount)
            cloud.lock();assertTrue(cloud.visible(listOf(record)).isEmpty());assertEquals("",cloud.recovery)
            cloud.load();assertEquals(1,cloud.pendingCount);assertEquals(record.id,cloud.visible(listOf(record)).single().id)
            val other=HybridController(context,scope,FakeAccount("synthetic-B"),"test-sync-state");other.load()
            assertEquals(0,other.pendingCount);assertTrue(other.visible(listOf(record)).isEmpty());other.lock()
            val stored=java.io.File(context.noBackupFilesDir,"test-sync-state.enc").readBytes().toString(Charsets.ISO_8859_1)
            assertFalse(stored.contains("SYNTHETIC"));assertFalse(stored.contains("synthetic-A"))
            fun awaitAction()=runBlocking{withTimeout(5000){while(cloud.busy)delay(10)}}
            cloud.action{backend.uid="synthetic-B";cloud.signedIn()};awaitAction();cloud.key()
            backend.nextCursor="B-only-page";cloud.sync{_,_->};awaitAction();assertEquals("B-only-page",cloud.cursor)
            cloud.action{backend.uid="synthetic-C";cloud.signedIn()};awaitAction()
            assertNull(cloud.cursor);assertTrue(cloud.visible(listOf(record)).isEmpty())
        }finally{cloud.reset();scope.cancel()}
    }
}
