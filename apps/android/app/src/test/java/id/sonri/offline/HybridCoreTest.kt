package id.sonri.offline

import id.sonri.offline.core.*
import id.sonri.offline.hybrid.*
import kotlinx.serialization.json.Json
import org.junit.Assert.*
import org.junit.Test
import java.security.KeyPairGenerator
import java.security.Signature
import java.time.Instant
import java.util.Base64

class HybridCoreTest {
    @Test fun crossDeviceRandomKeyRoundtripRejectsWrongOwnerKeyAndTampering(){
        val key=SyncCrypto.newKey();val record=ResearchRecord(researchConsent=true)
        val value=SyncCrypto.seal(record,"uid-A",1,"operation",key)
        assertEquals(record,SyncCrypto.open(value,"uid-A",key))
        assertThrows(Exception::class.java){SyncCrypto.open(value,"uid-B",key)}
        assertThrows(Exception::class.java){SyncCrypto.open(value,"uid-A",SyncCrypto.newKey())}
        assertThrows(Exception::class.java){SyncCrypto.open(value.copy(revision=2),"uid-A",key)}
        assertThrows(Exception::class.java){SyncCrypto.open(value.copy(tombstone=true),"uid-A",key)}
        assertThrows(Exception::class.java){SyncCrypto.open(value.copy(operationId="forged-operation"),"uid-A",key)}
        assertThrows(Exception::class.java){SyncCrypto.seal(record.copy(dataKind="AUTHORIZED_NONPATIENT",permissionReference="authorized-ref"),"uid-A",1,"operation",key)}
    }
    @Test fun signedMetadataEnforcesTrustExpirySequenceSecurityFloorAndContracts(){
        val pair=KeyPairGenerator.getInstance("EC").apply{initialize(256)}.generateKeyPair()
        val public=Base64.getEncoder().encodeToString(pair.public.encoded)
        fun signed(manifest:ReleaseManifest):ByteArray {
            val bytes=Json.encodeToString(manifest).toByteArray();val signature=Signature.getInstance("SHA256withECDSA").run{initSign(pair.private);update(bytes);sign()}
            return Json.encodeToString(SignedEnvelope(Base64.getEncoder().encodeToString(bytes),Base64.getEncoder().encodeToString(signature))).toByteArray()
        }
        val m=ReleaseManifest(sequence=1,expiresAt=Instant.now().plusSeconds(3600).toString(),minimumSafeVersion=1,models=listOf(ModelRelease(1,"/software.bin",173,"a".repeat(64))))
        val (valid,hash)=SignedUpdates.verify(signed(m),public,"https://research.example",UpdateState())
        assertEquals(1,valid.sequence)
        val envelope=Json.decodeFromString<SignedEnvelope>(signed(m).toString(Charsets.UTF_8))
        val tampered=Json.encodeToString(envelope.copy(signature=Base64.getEncoder().encodeToString(ByteArray(64)))).toByteArray()
        assertThrows(Exception::class.java){SignedUpdates.verify(tampered,public,"https://research.example",UpdateState())}
        val app=ApplicationRelease(2,"id.sonri.offline.research","a".repeat(64),"https://appdistribution.firebase.google.com/")
        assertTrue(SignedUpdates.compatibleApp(app,1,"id.sonri.offline.research","a".repeat(64)))
        assertFalse(SignedUpdates.compatibleApp(app,2,"id.sonri.offline.research","a".repeat(64)))
        assertFalse(SignedUpdates.compatibleApp(app,1,"other.package","a".repeat(64)))
        assertFalse(SignedUpdates.compatibleApp(app,1,"id.sonri.offline.research","b".repeat(64)))
        assertThrows(Exception::class.java){SignedUpdates.verify(signed(m),public,"http://research.example",UpdateState())}
        assertThrows(Exception::class.java){SignedUpdates.verify(signed(m),public,"https://research.example",UpdateState(sequence=2))}
        assertThrows(Exception::class.java){SignedUpdates.verify(signed(m),public,"https://research.example",UpdateState(floor=2))}
        assertThrows(Exception::class.java){SignedUpdates.verify(signed(m.copy(expiresAt=Instant.now().minusSeconds(1).toString())),public,"https://research.example",UpdateState())}
        assertThrows(Exception::class.java){SignedUpdates.verify(signed(m.copy(models=listOf(m.models[0].copy(contract="RFDETR")))),public,"https://research.example",UpdateState())}
        assertEquals(m,SignedUpdates.verify(signed(m),public,"https://research.example",UpdateState(sequence=1,payloadHash=hash)).first)
    }
}
