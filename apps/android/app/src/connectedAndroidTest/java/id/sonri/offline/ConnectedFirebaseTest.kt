package id.sonri.offline

import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.ext.junit.runners.AndroidJUnit4
import id.sonri.offline.core.*
import id.sonri.offline.hybrid.*
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.net.URL
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class ConnectedFirebaseTest {
    @Test fun independentAndroidClientsUseRealEmulatorAuthEncryptionAndConflicts()=runBlocking {
        assumeTrue(BuildConfig.USE_EMULATORS)
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        val a=FirebaseBackend(context,"synthetic-A");val b=FirebaseBackend(context,"synthetic-B");val c=FirebaseBackend(context,"synthetic-other")
        val email="synthetic-${UUID.randomUUID()}@example.test";val password=UUID.randomUUID().toString()+"!Aa9"
        a.register(email,password);assertFalse(a.identity()!!.verified)
        val codes=Json.parseToJsonElement(URL("http://10.0.2.2:9099/emulator/v1/projects/demo-sonri-hybrid/oobCodes").readText()).jsonObject.getValue("oobCodes").jsonArray
        val code=codes.last{it.jsonObject["email"]?.jsonPrimitive?.content==email}.jsonObject.getValue("oobCode").jsonPrimitive.content
        a.auth.applyActionCode(code).result();a.refresh();assertTrue(a.identity()!!.verified)
        a.profile("SYNTHETIC A",false);b.login(email,password);b.refresh()
        val uid=a.identity()!!.uid;val key=SyncCrypto.newKey();val record=ResearchRecord(researchConsent=true)
        val first=SyncCrypto.seal(record,uid,1,UUID.randomUUID().toString(),key)
        a.push(first,0);a.push(first,0) // exactly idempotent retry after an unknown commit outcome
        val restored=SyncCrypto.open(b.page(null).records.single{it.recordId==record.id},uid,key);assertEquals(record,restored)
        b.db.disableNetwork().result()
        val edit=SyncCrypto.seal(record.copy(alias="SYNTHETIC offline edit"),uid,2,UUID.randomUUID().toString(),key)
        try{b.push(edit,1);fail("Offline transaction must not claim sync success")}catch(_:Exception){}
        assertEquals("SYNTHETIC offline edit",SyncCrypto.open(edit,uid,key).alias)
        b.db.enableNetwork().result();b.push(edit,1)
        try{a.push(SyncCrypto.seal(record,uid,2,UUID.randomUUID().toString(),key),1);fail("Stale edit must conflict")}catch(_:Exception){}
        val reviewed=restored.copy(review=LocalReview("K02.9","Synthetic reviewer","Synthetic reviewed reference only"))
        b.push(SyncCrypto.seal(reviewed,uid,3,UUID.randomUUID().toString(),key),2)
        try{a.push(SyncCrypto.seal(record,uid,4,UUID.randomUUID().toString(),key),3);fail("Reviewed revision must be immutable")}catch(_:Exception){}
        c.register("other-${UUID.randomUUID()}@example.test",UUID.randomUUID().toString()+"!Aa9")
        try{c.db.collection("accounts").document(uid).get().result();fail("Other account denied")}catch(_:Exception){}
        a.requestDeletion();assertEquals("PENDING_OPERATOR_PURGE",a.db.collection("deletionRequests").document(uid).get().result().getString("status"))
        a.resetPassword(email)
        a.auth.signOut();assertNull(a.identity())
        InstrumentationRegistry.getInstrumentation().sendStatus(0,android.os.Bundle().apply{putString("sonri_scope","ANDROID_TWO_NAMED_FIREBASE_CLIENTS_LOCAL_EMULATORS_ONLY_NOT_HOSTED_OR_TWO_PHONES")})
    }
}
