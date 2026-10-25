package id.sonri.offline.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import id.sonri.offline.core.*
import kotlinx.serialization.json.Json
import java.io.File
import java.security.KeyStore
import java.time.Instant
import java.time.temporal.ChronoUnit
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Ciphertext only in noBackupFilesDir. UI device-credential gate is separate from professional identity. */
class LocalVault(context: Context, private val alias: String = "sonri.offline.records.v1") {
    val file = File(context.noBackupFilesDir, if(alias.endsWith(".test"))"test-vault.enc" else "research-vault.enc")
    private val json=Json { encodeDefaults=true }
    private val aad="sonri.offline.vault.v1".toByteArray()
    private fun key(): SecretKey {
        val store=KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(alias,null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(alias,KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setKeySize(256).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true).setUnlockedDeviceRequired(true).build())
        }.generateKey()
    }
    @Synchronized fun load(): VaultData {
        if(!file.exists())return VaultData()
        require(file.length() in 30..10_000_000) { "VAULT_SIZE_REJECTED" }
        val bytes=AtomicFile(file).readFully()
        require(bytes.copyOfRange(0,6).contentEquals("SONRI1".toByteArray())) { "VAULT_FORMAT_REJECTED" }
        val cipher=Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE,key(),GCMParameterSpec(128,bytes.copyOfRange(6,18)));cipher.updateAAD(aad)
        val plaintext=cipher.doFinal(bytes,18,bytes.size-18)
        try {
            val data=json.decodeFromString<VaultData>(plaintext.toString(Charsets.UTF_8))
            validate(data);return data
        } finally { plaintext.fill(0) }
    }
    private fun validate(data: VaultData) {
        require(data.schemaVersion==1 && data.records.size<=100 && data.retentionDays in 7..90 && data.modelPermissionReference.length<=300)
        require(data.records.map { it.id }.distinct().size==data.records.size)
        data.records.forEach(DentalRules::validate)
    }
    @Synchronized fun save(data: VaultData) {
        validate(data)
        val plaintext=json.encodeToString(data).toByteArray()
        require(plaintext.size<=8_000_000) { "VAULT_CAPACITY_REACHED" }
        val cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());cipher.updateAAD(aad)
        val ciphertext=try { cipher.doFinal(plaintext) } finally { plaintext.fill(0) }
        val atomic=AtomicFile(file);val stream=atomic.startWrite()
        try { stream.write("SONRI1".toByteArray());stream.write(cipher.iv);stream.write(ciphertext);atomic.finishWrite(stream) }
        catch(error: Exception) { atomic.failWrite(stream);throw error }
    }
    fun prune(data: VaultData): VaultData {
        val cutoff=Instant.now().minus(data.retentionDays.toLong(),ChronoUnit.DAYS)
        return data.copy(records=data.records.filter { Instant.parse(it.updatedAt).isAfter(cutoff) })
    }
    @Synchronized fun deleteAll() {
        AtomicFile(file).delete()
        KeyStore.getInstance("AndroidKeyStore").apply { load(null);deleteEntry(alias) }
    }
}
