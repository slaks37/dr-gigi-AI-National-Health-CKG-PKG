package id.sonri.offline.hybrid

import android.app.Activity
import androidx.activity.compose.LocalActivity
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import id.sonri.offline.SonriViewModel

@Composable fun AccountPanel(vm:SonriViewModel){
    val cloud=vm.cloud;val activity=LocalActivity.current ?: return
    var email by remember{mutableStateOf("")};var password by remember{mutableStateOf("")};var name by remember{mutableStateOf("")}
    var participation by remember{mutableStateOf(false)};var code by remember{mutableStateOf("")}
    var confirmMigration by remember{mutableStateOf(false)};var deleting by remember{mutableStateOf(false)}
    LaunchedEffect(vm.unlocked){if(!vm.unlocked){code="";password="";email="";name=""}}
    LaunchedEffect(cloud.profileName){if(cloud.profileName.isNotBlank()){name=cloud.profileName;participation=cloud.participation}}
    Text(if(vm.online)"Online • ketersediaan cloud diperiksa saat sinkronisasi" else "Offline • AI dan catatan lokal tetap tersedia")
    Text(cloud.status)
    Text("Akun: ${cloud.identity?.email ?: "Tamu lokal"}. ${if(cloud.identity?.verified==true)"Email terverifikasi" else "Belum terverifikasi"}")
    Text("Login tidak memverifikasi profesi. Cloud MVP hanya untuk catatan SINTETIS berizin, tanpa gambar; data pasien tetap di perangkat.")
    if(cloud.identity?.clinicianVerified==true)Text("Klaim profesi telah ditetapkan oleh operator terpercaya. Akses catatan tetap memerlukan penugasan terpisah.")
    if(!vm.unlocked){Text("Buka workspace dengan kunci perangkat untuk mengelola akun.");return}
    if(cloud.backend?.configured!=true)Text("Project Firebase riset terpisah belum tersedia. Akun cloud belum aktif; pemeriksaan lokal tetap dapat digunakan.")
    val enabled=!cloud.busy && cloud.backend?.configured==true && !vm.busy
    if(cloud.identity==null){
        OutlinedTextField(email,{email=it.take(254)},label={Text("Email")},modifier=Modifier.fillMaxWidth())
        OutlinedTextField(password,{password=it.take(128)},label={Text("Kata sandi")},visualTransformation=PasswordVisualTransformation(),modifier=Modifier.fillMaxWidth())
        Button({val p=password;password="";cloud.action{it.register(email,p);cloud.signedIn()}},enabled=enabled){Text("Daftar dan kirim verifikasi email")}
        Button({val p=password;password="";cloud.action{it.login(email,p);cloud.signedIn()}},enabled=enabled){Text("Masuk dengan email")}
        OutlinedButton({cloud.action{it.google(activity);cloud.signedIn()}},enabled=enabled){Text("Masuk dengan Google")}
        TextButton({cloud.action{it.resetPassword(email)}},enabled=enabled){Text("Pulihkan kata sandi melalui email")}
    }else{
        TextButton({cloud.action{it.refresh();cloud.signedIn()}},enabled=enabled){Text("Periksa ulang verifikasi dan sesi")}
        TextButton({cloud.action{it.verifyEmail()}},enabled=enabled){Text("Kirim ulang verifikasi")}
        OutlinedTextField(name,{name=it.take(80)},label={Text("Nama tampilan akun riset")},modifier=Modifier.fillMaxWidth())
        Row{Checkbox(participation,{participation=it});Text("Bersedia dihubungi untuk riset; tidak mengizinkan pelatihan dari catatan.")}
        Button({cloud.action{it.profile(name,participation)}},enabled=enabled && cloud.identity?.verified==true && name.isNotBlank()){Text("Simpan profil dan preferensi cloud")}
        Text("Pemulihan lintas perangkat memakai kode acak 256-bit yang Anda simpan sendiri. Pemilik server tidak memiliki kuncinya. Kehilangan kode dan perangkat berarti catatan tidak dapat dipulihkan. Belum direview untuk data pasien.")
        OutlinedTextField(code,{code=it.take(43)},label={Text("Kode pemulihan dari perangkat lain")},visualTransformation=PasswordVisualTransformation(),modifier=Modifier.fillMaxWidth())
        TextButton({try{cloud.key(code.ifBlank{null});code=""}catch(_:Exception){vm.notice("Kunci tidak valid atau sudah terikat data; rotasi memerlukan proses terpisah.")}},enabled=enabled){Text("Buat atau impor kunci pemulihan")}
        TextButton({cloud.revealKey()},enabled=enabled){Text("Tampilkan kode untuk disimpan pribadi")}
        if(cloud.recovery.isNotBlank())Text(cloud.recovery)
        val preview=cloud.migrationPreview(vm.records)
        Text("Migrasi tamu opsional: ${preview.size} catatan sintetis memenuhi syarat. Tidak ada unggahan otomatis data tamu.")
        preview.take(20).forEach{Text("• ${it.alias} • ${it.id.take(8)} • versi ${it.version}")}
        Button({confirmMigration=true},enabled=enabled && preview.isNotEmpty()){Text("Tinjau dan antrekan migrasi tamu...")}
        Text("Menunggu sinkronisasi: ${cloud.pendingCount}. Konflik: ${cloud.conflicts.size}.")
        cloud.conflicts.forEach{Text("Konflik ${it.take(8)}: catatan dipertahankan; tidak ada penggabungan otomatis. Ekspor kedua versi untuk peninjauan operator.")}
        Button(vm::syncCloud,enabled=enabled){Text(if(cloud.cursor==null)"Sinkronkan catatan sintetis" else "Sinkronkan halaman berikutnya")}
        Text("Ekspor data perangkat melalui menu Laporan. Pulihkan seluruh halaman cloud sebelum ekspor lengkap. Tombstone bukan pemusnahan seluruh revisi.")
        TextButton({deleting=true},enabled=enabled){Text("Minta penghapusan akun dan seluruh revisi...")}
        TextButton({cloud.signOut(activity)},enabled=enabled){Text("Keluar dan sembunyikan catatan akun")}
    }
    if(confirmMigration)AlertDialog(onDismissRequest={confirmMigration=false},title={Text("Kirim catatan sintetis terenkripsi?")},text={Text("Hanya 20 catatan sintetis yang ditampilkan pada halaman ini akan diikat ke akun ini. Nama file/gambar tidak dikirim. Simpan kode pemulihan secara pribadi. Data penelitian nyata belum diizinkan untuk cloud.")},confirmButton={TextButton({confirmMigration=false;try{cloud.migrate(cloud.migrationPreview(vm.records).take(20),true)}catch(_:Exception){vm.notice("Verifikasi email dan kode pemulihan diperlukan.")}}){Text("Setuju dan antrekan")}},dismissButton={TextButton({confirmMigration=false}){Text("Batal")}})
    if(deleting)AlertDialog(onDismissRequest={deleting=false},title={Text("Permintaan penghapusan cloud")},text={Text("Operator harus menghapus seluruh revisi dan akun melalui proses terpercaya. Tombol ini mencatat permintaan, bukan menyatakan penghapusan selesai. Data perangkat/ekspor dikelola terpisah.")},confirmButton={TextButton({deleting=false;cloud.action{it.requestDeletion()}}){Text("Catat permintaan")}},dismissButton={TextButton({deleting=false}){Text("Batal")}})
}
