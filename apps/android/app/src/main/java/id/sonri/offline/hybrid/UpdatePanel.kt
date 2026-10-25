package id.sonri.offline.hybrid

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import id.sonri.offline.SonriViewModel
import id.sonri.offline.BuildConfig

@Composable fun UpdatePanel(vm:SonriViewModel){
    val update=vm.updates
    Text("Pembaruan riset • AI utama tetap berjalan di perangkat")
    Text(update.status)
    Text("Bobot dental belum diizinkan untuk distribusi publik. Pembaruan saat ini hanya mendukung kernel ONNX sintetis untuk pengujian mekanisme, bukan kemampuan diagnosis baru.")
    if(!vm.unlocked){Text("Buka workspace untuk memeriksa pembaruan.");return}
    val enabled=!vm.busy && !update.busy
    Button(update::check,enabled=enabled && BuildConfig.NETWORK_ENABLED){Text("Periksa metadata pembaruan resmi")}
    if(update.busy){LinearProgressIndicator();Text("${update.progress} byte");TextButton(update::cancel){Text("Batalkan unduhan")}}
    update.available.forEach{release -> OutlinedButton({update.install(release)},enabled=enabled){Text("Unduh artefak uji versi ${release.version} (${release.bytes} byte)")}}
    Text("Versi uji aktif: ${update.active?.version ?: "belum ada"}")
    OutlinedButton(update::runOffline,enabled=enabled && update.active!=null){Text("Uji eksekusi artefak aktif tanpa jaringan")}
    TextButton(update::rollback,enabled=enabled){Text("Kembali ke versi kompatibel sebelumnya")}
    update.appRelease?.let{release ->
        if(update.appCompatible(release))Text("Pembaruan aplikasi tersedia: ${release.versionCode}. Instalasi resmi: ${release.installUrl}")
        else Text("Info rilis ${release.versionCode} tidak lebih baru atau package/signature tidak cocok; instalasi tidak ditawarkan.")
        Text("Pembaruan APK memerlukan persetujuan pengguna, versi lebih tinggi, package dan signature yang sama. Tidak dipasang diam-diam; jangan hentikan pemeriksaan aktif.")
    }
}
