package id.sonri.offline.hybrid

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import java.io.File
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Separate authenticated file preserves the original vault's schema and keys. */
class ProtectedState(context:Context,name:String) {
    private val file=AtomicFile(File(context.noBackupFilesDir,"$name.enc"))
    private val alias="sonri.hybrid.$name.v1"
    private fun key():SecretKey {
        val store=KeyStore.getInstance("AndroidKeyStore").apply{load(null)}
        return store.getKey(alias,null) as? SecretKey ?: KeyGenerator.getInstance("AES","AndroidKeyStore").apply{
            init(KeyGenParameterSpec.Builder(alias,KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT).setKeySize(256)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setUnlockedDeviceRequired(true).build())
        }.generateKey()
    }
    @Synchronized fun read():String? {
        if(!file.baseFile.exists())return null
        require(file.baseFile.length() in 28..10_000_000)
        val bytes=file.readFully();val c=Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.DECRYPT_MODE,key(),GCMParameterSpec(128,bytes.copyOfRange(0,12)));c.updateAAD(alias.toByteArray())
        val plain=c.doFinal(bytes,12,bytes.size-12)
        return try{plain.toString(Charsets.UTF_8)}finally{plain.fill(0)}
    }
    @Synchronized fun write(value:String) {
        val plain=value.toByteArray();require(plain.size<=8_000_000)
        val c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,key());c.updateAAD(alias.toByteArray())
        val bytes=try{c.doFinal(plain)}finally{plain.fill(0)}
        val out=file.startWrite();try{out.write(c.iv);out.write(bytes);file.finishWrite(out)}catch(e:Exception){file.failWrite(out);throw e}
    }
    fun delete(){file.delete();KeyStore.getInstance("AndroidKeyStore").apply{load(null);deleteEntry(alias)}}
}
