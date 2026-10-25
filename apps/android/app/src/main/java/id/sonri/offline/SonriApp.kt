package id.sonri.offline

import android.app.ActivityManager
import android.content.Context
import android.graphics.Paint
import android.os.Build
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.sonri.offline.core.*
import id.sonri.offline.hybrid.AccountPanel
import kotlinx.coroutines.launch
import java.util.Locale

@Composable private fun Heading(text: String) { Text(text,style=MaterialTheme.typography.titleLarge) }
@Composable private fun Hint(text: String) { Text(text,style=MaterialTheme.typography.bodyMedium,color=Color(0xFF4B5B60)) }
@Composable private fun Action(text: String,enabled: Boolean=true,action: ()->Unit) { Button(onClick=action,enabled=enabled,modifier=Modifier.fillMaxWidth().heightIn(min=48.dp).testTag("action-$text")) { Text(text) } }
@Composable private fun Field(label: String,value: String,enabled: Boolean=true,change: (String)->Unit) { OutlinedTextField(value,onValueChange={ change(it.take(4000)) },label={Text(label)},enabled=enabled,modifier=Modifier.fillMaxWidth(),minLines=2) }
@Composable private fun Check(label: String,checked: Boolean,enabled: Boolean=true,change: (Boolean)->Unit) { Row(Modifier.fillMaxWidth().clickable(enabled=enabled) { change(!checked) }.padding(vertical=4.dp)) { Checkbox(checked,change,enabled=enabled);Text(label,Modifier.weight(1f).padding(top=12.dp)) } }
@Composable private fun AnalysisStatus(vm:SonriViewModel) {
    Text(vm.modelReadinessMessage(),Modifier.testTag("analysis-model-status"),style=MaterialTheme.typography.bodyMedium)
    if(vm.message.isNotBlank())Surface(color=Color(0xFFFFEDC2),shape=RoundedCornerShape(12.dp)) {
        Text(vm.message,Modifier.padding(12.dp).testTag("analysis-status"))
    }
    if(vm.busy){LinearProgressIndicator(Modifier.fillMaxWidth().testTag("analysis-progress"));Text(vm.status)}
    if(vm.cloud.busy)Hint("Sinkronisasi sedang berlangsung. Tunggu hingga selesai sebelum menjalankan analisis lokal.")
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable fun SonriApp(vm: SonriViewModel,unlock: ()->Unit,pickImage: ()->Unit,pickModel: ()->Unit,export: (String)->Unit,securitySettings: ()->Unit) {
    val drawer=rememberDrawerState(DrawerValue.Closed);val scope=rememberCoroutineScope()
    val record=vm.current
    var exportFormat by remember { mutableStateOf<String?>(null) }
    var deleting by remember { mutableStateOf<String?>(null) }
    var resetting by remember { mutableStateOf(false) }
    BackHandler(vm.screen!=Screen.WELCOME && vm.screen!=Screen.WORKSPACE) { vm.screen=if(vm.unlocked)Screen.WORKSPACE else Screen.WELCOME }
    MaterialTheme(colorScheme=lightColorScheme(primary=Color(0xFF006B65),secondary=Color(0xFF38656E))) {
        ModalNavigationDrawer(drawerState=drawer,drawerContent={
            ModalDrawerSheet { Column(Modifier.verticalScroll(rememberScrollState())) {
                Text("SONRI • Riset offline",Modifier.padding(20.dp),style=MaterialTheme.typography.titleLarge)
                val primary=listOf(Screen.WORKSPACE,Screen.SELECT_EXAM,Screen.HISTORY,Screen.ODONTOGRAM,Screen.REVIEW,Screen.PROFILE,Screen.UPDATES,Screen.DEVICE,Screen.TERMS)
                (primary+Screen.entries.filter{it !in primary}).forEach { screen -> NavigationDrawerItem(label={ Text(when(screen){Screen.WORKSPACE->"Beranda";Screen.SELECT_EXAM->"Pemeriksaan";Screen.HISTORY->"Riwayat";Screen.REVIEW->"Tinjauan";Screen.PROFILE->"Profil";Screen.DEVICE->"Pengaturan";else->screen.title}) },selected=vm.screen==screen,onClick={
                    vm.screen=if(vm.unlocked || screen in setOf(Screen.WELCOME,Screen.TERMS,Screen.DEVICE))screen else Screen.WELCOME
                    scope.launch { drawer.close() }
                }) }
            } }
        }) {
            Scaffold(topBar={ TopAppBar(title={ Column { Text("SONRI Riset");Text("${if(vm.online)"Online" else "Offline"} • AI diproses di perangkat",fontSize=12.sp) } },navigationIcon={ TextButton(onClick={ scope.launch { drawer.open() } },modifier=Modifier.testTag("menu")) {Text("Menu")} },actions={if(vm.unlocked)TextButton(onClick=vm::lock){Text("Kunci")}}) }) { padding ->
                Column(Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(18.dp),verticalArrangement=Arrangement.spacedBy(12.dp)) {
                    if(vm.message.isNotBlank())Surface(color=Color(0xFFFFEDC2),shape=RoundedCornerShape(12.dp)) { Text(vm.message,Modifier.padding(12.dp).testTag("status")) }
                    if(vm.busy) { LinearProgressIndicator(Modifier.fillMaxWidth());Text(vm.status);Action("Batalkan",action=vm::cancel) }
                    val visible=if(!vm.unlocked && vm.screen !in setOf(Screen.WELCOME,Screen.TERMS,Screen.DEVICE))Screen.WELCOME else vm.screen
                    Heading(visible.title)
                    when(visible) {
                        Screen.WELCOME -> {
                            Text("Selamat datang di SONRI. AI gambar berjalan di perangkat, saat terhubung maupun offline. Akun dan sinkronisasi riset tersedia setelah konfigurasi terpisah.")
                            Hint("Hanya fixture sintetis atau data nonpasien yang memiliki izin. Bukan untuk pelayanan pasien, diagnosis otomatis, atau keputusan terapi.")
                            Hint("Makna kelas model belum terverifikasi; istilah ICD-10 bukan kemampuan diagnosis AI. Nama atau login tidak memverifikasi profesi dokter gigi.")
                            Check("Saya memahami batas riset dan tidak memakai aplikasi ini untuk perawatan pasien.",vm.disclaimerAccepted) { vm.disclaimerAccepted=it }
                            Action("Buka workspace dengan kunci perangkat",vm.disclaimerAccepted,unlock)
                            Action("Atur kunci layar Android",action=securitySettings)
                            Action("Buka katalog offline",action={vm.screen=Screen.TERMS})
                            Hint("Catatan perangkat dienkripsi dengan Android Keystore. Sinkronisasi riset opsional hanya untuk catatan sintetis yang dipilih. Kerusakan, penghapusan aplikasi, atau kehilangan perangkat/kunci dapat menghilangkan catatan yang belum dapat dipulihkan.")
                        }
                        Screen.WORKSPACE -> {
                            Text("${vm.records.size} catatan riset lokal. Gambar asli tidak disimpan.")
                            record?.let { Text("Aktif: ${it.alias} • versi ${it.version}");Hint("${it.id}\n${if(it.review==null)"Belum direview" else "Review lokal; identitas profesi belum diverifikasi"}") }
                            Action("Pemeriksaan riset baru",!vm.busy,vm::newRecord)
                            Action("Lanjutkan pemeriksaan",record!=null && !vm.busy,{vm.screen=Screen.SELECT_EXAM})
                            Action("Riwayat terenkripsi",!vm.busy,{vm.screen=Screen.HISTORY})
                            Action("Model dan kompatibilitas",action={vm.screen=Screen.DEVICE})
                            Action("Profil dan sinkronisasi",action={vm.screen=Screen.PROFILE})
                            Hint(if(BuildConfig.NETWORK_ENABLED)"AI tetap di perangkat. Kelola akun dan antrean sinkronisasi sintetis di Profil. Workspace terkunci saat meninggalkan aplikasi." else "Mode riset lokal tanpa jaringan. Aplikasi terkunci saat meninggalkan layar; pemilih file sistem dapat meminta otorisasi perangkat lagi.")
                        }
                        Screen.SELECT_EXAM -> if(record==null)Action("Buat pemeriksaan",action=vm::newRecord) else {
                            Field("Alias riset (tanpa nama/NIK pasien)",record.alias,!vm.busy) { value -> vm.update { it.copy(alias=value.take(80)) } }
                            Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                                FilterChip(record.dataKind=="SYNTHETIC",{vm.update { it.copy(dataKind="SYNTHETIC") }},label={Text("Sintetis")})
                                FilterChip(record.dataKind=="AUTHORIZED_NONPATIENT",{vm.update { it.copy(dataKind="AUTHORIZED_NONPATIENT") }},label={Text("Nonpasien berizin")})
                            }
                            if(record.dataKind!="SYNTHETIC")Field("Referensi izin data (bukan identitas pasien)",record.permissionReference,!vm.busy) { value -> vm.update {it.copy(permissionReference=value.take(300))} }
                            Check("Saya memiliki izin memproses data riset ini secara lokal; tidak ada pasien nyata.",record.researchConsent,!vm.busy) { value -> vm.update { it.copy(researchConsent=value) } }
                            Action("Impor gambar / fixture",vm.consentReady() && !vm.busy,{vm.screen=Screen.IMPORT})
                            Action("Pemeriksaan klinis terstruktur",vm.consentReady() && !vm.busy,{vm.screen=Screen.EXAM})
                            Action("Simpan draft terenkripsi",vm.consentReady() && !vm.busy,{try {vm.save()}catch(_:Exception){vm.notice("Draft belum memenuhi kontrak atau kapasitas penyimpanan.")}})
                        }
                        Screen.IMPORT -> {
                            Hint(if(BuildConfig.NETWORK_ENABLED)"Pilih hanya gambar lokal berizin. Pemilih foto Android dapat menawarkan penyedia cloud milik sistem. SONRI memproses gambar di perangkat; sinkronisasi riset tidak mengirim gambar. Untuk uji offline, gunakan file lokal/fixture bawaan." else "Pilih hanya gambar lokal berizin. Pemilih foto Android dapat menawarkan penyedia cloud milik sistem; aplikasi SONRI tidak memiliki izin INTERNET. Untuk uji offline, gunakan file lokal/fixture bawaan.")
                            Action("Pilih gambar Android",vm.consentReady() && !vm.busy && record?.review==null,pickImage)
                            Action("Kamera lokal",vm.consentReady() && !vm.busy && record?.review==null,{vm.screen=Screen.CAMERA})
                            Action("Buka fixture geometris sintetis",vm.consentReady() && !vm.busy && record?.review==null,vm::syntheticImage)
                            Hint("JPEG/PNG/WebP/HEIF yang didukung perangkat; maksimal 25 MB dan 16 megapiksel. Orientasi EXIF diterapkan, tanpa resize decode tersembunyi. Gambar hanya berada di RAM.")
                        }
                        Screen.CAMERA -> CameraScreen(vm)
                        Screen.QUALITY -> {
                            vm.image?.let { Image(it.bitmap.asImageBitmap(),"Gambar riset lokal",Modifier.fillMaxWidth().height(220.dp)) }
                            (vm.image?.quality ?: record?.quality)?.let { q ->
                                Text("${q.width} × ${q.height} • kecerahan %.1f • kontras %.1f • variasi Laplacian %.1f".format(Locale.US,q.meanBrightness,q.contrast,q.laplacianVariance))
                                q.warnings.forEach { Hint("• $it") }
                            } ?: Hint("Belum ada gambar.")
                            Hint("Pemeriksaan teknis ini bukan penilai kelayakan klinis, lokasi gigi, atau modalitas yang tervalidasi.")
                            Check("Saya memeriksa gambar dan memahami batas kualitas/modalitas untuk riset.",vm.qualityAcknowledged,!vm.busy) { vm.qualityAcknowledged=it }
                            AnalysisStatus(vm)
                            if(!vm.modelReady()) {
                                Action("Impor model lokal untuk analisis",!vm.busy && !vm.cloud.busy,{vm.screen=Screen.DEVICE})
                                Hint("Setelah impor melalui pemilih file Android, buka kembali gambar atau fixture karena gambar di RAM dikosongkan saat workspace terkunci.")
                            }
                            Action("Jalankan AI lokal sebenarnya",vm.modelReady() && vm.image!=null && vm.qualityAcknowledged && vm.consentReady() && record?.review==null && !vm.busy && !vm.cloud.busy,vm::analyze)
                        }
                        Screen.ANALYSIS -> {
                            Hint("CPUExecutionProvider • float32 • 704×704 • dua thread. Tidak ada kuantisasi atau perubahan resolusi model. Target 15 detik belum merupakan hasil pengukuran ponsel.")
                            AnalysisStatus(vm)
                            Action("Analisis gambar aktif",vm.modelReady() && vm.image!=null && vm.qualityAcknowledged && vm.consentReady() && record?.review==null && !vm.busy && !vm.cloud.busy,vm::analyze)
                            Action(if(vm.modelReady())"Periksa model lokal" else "Impor model lokal untuk analisis",!vm.busy && !vm.cloud.busy,{vm.screen=Screen.DEVICE})
                        }
                        Screen.RESULTS -> {
                            Heading("Hasil Analisis Awal SONRI AI")
                            if(record?.ai!=null)Text("AI telah menganalisis gambar dan menandai area yang perlu diperhatikan.")
                            Hint("Rilis riset: makna kategori model belum terverifikasi. Hasil AI merupakan informasi pendukung dan bukan diagnosis medis. Konsultasikan dengan dokter gigi untuk pemeriksaan, diagnosis, dan penanganan yang tepat.")
                            if(vm.image!=null && record?.ai!=null)BoxOverlay(vm.image!!.bitmap,record.ai.findings)
                            else Hint("Gambar tidak disimpan. Impor ulang gambar identik untuk menampilkan overlay catatan sebelumnya.")
                            record?.ai?.let { ai ->
                                Text("${ai.findings.size} area ditandai • kategori belum terverifikasi")
                                Hint("Nol deteksi bukan bukti sehat. Skor model tidak terkalibrasi sebagai probabilitas penyakit.")
                                Action("Bukti eksekusi dan keterbatasan",action={vm.screen=Screen.EVIDENCE})
                            } ?: Hint("Belum ada eksekusi model berhasil. Tidak ada kotak buatan atau fallback server.")
                            Action("Masukkan pemeriksaan secara terpisah",record!=null,{vm.screen=Screen.EXAM})
                        }
                        Screen.EVIDENCE -> {
                            record?.ai?.let { ai ->
                                Text("Model: ${ai.modelVersion}\nSHA-256: ${ai.modelSha256}\n${ai.runtime}\n${ai.provider}")
                                Text("Hash: %.1f ms\nLoad: %.1f ms\nPreprocess: %.1f ms\nInferensi: %.1f ms\nTotal: %.1f ms".format(Locale.US,ai.hashMs,ai.loadMs,ai.preprocessMs,ai.inferenceMs,ai.totalMs))
                                Hint("Hash gambar: ${ai.imageSha256}\n${ai.width} × ${ai.height}\n${ai.preprocessing}")
                                ai.findings.forEach { Text("${it.rawLabel} • skor mentah %.4f • ${it.box}".format(Locale.US,it.score)) }
                            } ?: Hint("Belum ada bukti inferensi.")
                            Hint("Semua RAW_CLASS_0..4 tetap UNVERIFIED. Tidak ada binding penyakit/ICD-10, FDI otomatis, healthy class, atau validasi klinis. Modalitas dan makna kelas RF-DETR belum memiliki kontrak sumber otoritatif.")
                        }
                        Screen.EXAM -> if(record==null)Action("Buat pemeriksaan",action=vm::newRecord) else ExaminationForm(vm,record)
                        Screen.ODONTOGRAM -> if(record!=null)Odontogram(vm,record) else Hint("Buat pemeriksaan terlebih dahulu.")
                        Screen.TERMS -> {
                            Hint("WHO ICD-10 2010: 15 kategori, 108 kode terminal. Snapshot diperiksa SHA-256. Bukti AI dievaluasi/tervalidasi tetap 0/108.")
                            Field("Cari kode atau istilah resmi",vm.query) { vm.query=it.take(100) }
                            vm.selectedTerm?.let { term ->
                                Heading("${term.code} • ${term.title}")
                                term.inclusions.forEach { Hint("Termasuk: $it") };term.exclusions.forEach { Hint("Tidak termasuk: $it") };term.notes.forEach { Hint(it) }
                                term.workflow.limitations.forEach { Hint(it) }
                                Hint("Sumber: ${term.source}\nCek juga catatan kategori dan indeks WHO. Checklist SONRI adalah alur riset yang belum divalidasi klinisi.")
                                Action("Pilih sebagai kandidat MANUAL",vm.unlocked && record!=null && term.kind=="TERMINAL" && record.review==null && !vm.busy,{vm.choose(term)})
                            }
                            Terminology.search(vm.catalog,vm.query).forEach { term ->
                                OutlinedButton(onClick={vm.selectedTerm=term},modifier=Modifier.fillMaxWidth().testTag("term-${term.code}")) { Text("${term.code}  ${term.title}",Modifier.fillMaxWidth()) }
                            }
                        }
                        Screen.DIFFERENTIAL -> {
                            val term=vm.selectedTerm ?: vm.catalog.entries.find {it.code==record?.candidateCode}
                            if(term==null)Action("Pilih kode manual",action={vm.screen=Screen.TERMS}) else {
                                Text("Kandidat manual: ${term.code} • ${term.title}")
                                Hint("Bukan prediksi model dan bukan rekomendasi diagnosis otomatis.")
                                term.workflow.clinical_details.forEach { Text("• $it") }
                                val missing=Terminology.missing(term,record?.examination ?: Examination())
                                Heading("Bukti yang belum dicatat")
                                missing.forEach { Text("• ${vm.catalog.examination_labels[it]}") }
                                term.workflow.conditional_examinations.forEach { Hint("Sesuai indikasi klinisi: $it") }
                                Heading("Banding untuk penilaian manual")
                                term.workflow.differential_codes.filter { it!=term.code }.forEach { code -> Hint("$code • ${vm.catalog.entries.find { it.code==code }?.title.orEmpty()}") }
                                term.workflow.limitations.forEach { Hint(it) }
                                Hint("Daftar tidak lengkap. Kondisi di luar K00-K14 belum disingkirkan. Gangguan napas/menelan atau infeksi menyebar memerlukan penilaian darurat, bukan inferensi foto.")
                                Action("Lengkapi form pemeriksaan",record!=null,{vm.screen=Screen.EXAM})
                                Action("Review lokal",record!=null,{vm.screen=Screen.REVIEW})
                            }
                        }
                        Screen.REVIEW -> if(record!=null) {
                            Hint("Review ini mencatat keputusan peninjau lokal untuk simulasi riset. Tidak memverifikasi registrasi profesi dan tidak mengizinkan perawatan pasien.")
                            Text("Kandidat: ${record.candidateCode.ifBlank { "Belum dipilih manual" }}")
                            record.review?.let { Text("${it.code} • ${it.reviewerAlias}\n${it.evidence}\n${it.reviewedAt}");Action("Buka revisi riset",!vm.busy,vm::reopen) } ?: run {
                                Field("Alias peninjau lokal",vm.reviewer,!vm.busy) { vm.reviewer=it.take(80) }
                                Field("Bukti pemeriksaan yang mendasari keputusan (minimal 20 karakter)",vm.reviewEvidence,!vm.busy) {vm.reviewEvidence=it}
                                Check("Saya menyatakan peninjau adalah dokter gigi; aplikasi tidak memverifikasi pernyataan ini.",vm.dentistAttested,!vm.busy) {vm.dentistAttested=it}
                                Action("Catat review riset lokal",!vm.busy,vm::confirm)
                            }
                            Action("Pilih kode secara manual",record.review==null && !vm.busy,{vm.screen=Screen.TERMS})
                        } else Hint("Belum ada pemeriksaan.")
                        Screen.HISTORY -> {
                            Hint("Retensi bawaan 30 hari; dibersihkan saat workspace dibuka. Gambar tidak disimpan.")
                            vm.records.forEach { item -> Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(12.dp)) {
                                Text(item.alias,style=MaterialTheme.typography.titleMedium);Hint("${item.updatedAt} • v${item.version} • ${if(item.review==null)"Draft riset" else "Review lokal"}")
                                TextButton(onClick={vm.open(item)}) {Text("Buka catatan")};TextButton(onClick={deleting=item.id}){Text("Hapus lokal")}
                            } } }
                        }
                        Screen.REPORT -> if(record!=null) {
                            Text("${record.alias} • v${record.version}")
                            Text("Temuan AI mentah: ${record.ai?.findings?.size ?: "Belum dijalankan"}")
                            Text("Kandidat manual: ${record.candidateCode.ifBlank { "Belum ada" }}")
                            Text("Diagnosis dimasukkan peninjau: ${record.review?.code ?: "Belum direview"}")
                            Hint("Identitas profesi tidak diverifikasi. Validasi klinis NOT_ESTABLISHED. Laporan memuat provenance dan audit; tidak memuat gambar sumber.")
                            Action("Ekspor JSON...",vm.consentReady() && !vm.busy,{exportFormat="json"})
                            Action("Ekspor PDF...",vm.consentReady() && !vm.busy,{exportFormat="pdf"})
                        } else Hint("Belum ada catatan.")
                        Screen.DEVICE -> {
                            DeviceInformation()
                            Hint("Model tidak dibundel. Impor sekali dari file lokal; inferensi selanjutnya tidak memerlukan download. Hanya hash RF-DETR yang diaudit diterima.")
                            Text("Model: ${if(vm.model.file.exists())"File lokal tersedia; hash diperiksa sebelum setiap load" else "UNAVAILABLE - belum diimpor"}\nSHA-256: $RFDETR_SHA256\nUkuran: $RFDETR_BYTES byte")
                            Hint("Lisensi source RF-DETR tidak otomatis membuktikan hak model dental. Izin Android/redistribusi belum diverifikasi independen. YOLO11m Android belum diekspor; kontrak d/D dan kewajiban lisensi masih terbuka.")
                            if(vm.unlocked) {
                                Field("Referensi izin pemakaian/penyalinan model untuk riset",vm.pendingModelPermission,!vm.busy) {vm.pendingModelPermission=it.take(300)}
                                Check("Saya memiliki izin yang mencakup model ini dan penyalinan ke perangkat; bukan izin klinis.",vm.modelAcknowledged,!vm.busy) {vm.modelAcknowledged=it}
                                Action("Impor ONNX lokal terverifikasi",!vm.busy && vm.modelAcknowledged && vm.pendingModelPermission.trim().length>=8,pickModel)
                                if(vm.modelPermission.isNotBlank())Hint("Referensi izin lokal tercatat. Status: OWNER_ATTESTED_NOT_INDEPENDENTLY_VERIFIED.")
                                Row { listOf(7,30,90).forEach { days -> TextButton(onClick={vm.retention(days)}) {Text("$days hari")} } }
                                Action("Reset seluruh data riset dan model lokal...",!vm.busy,{resetting=true})
                            } else Hint("Buka workspace dengan kunci perangkat untuk impor model dan pengaturan data.")
                        }
                        Screen.PROFILE -> AccountPanel(vm)
                        Screen.UPDATES -> id.sonri.offline.hybrid.UpdatePanel(vm)
                    }
                    Spacer(Modifier.height(20.dp))
                }
            }
        }
        exportFormat?.let { format -> AlertDialog(onDismissRequest={exportFormat=null},title={Text("Ekspor berisi data yang didekripsi")},text={Text("File JSON/PDF tujuan dapat dibaca aplikasi atau pihak lain yang Anda pilih. Tidak ada pengiriman otomatis. Pilih penyimpanan lokal yang aman; salinan ekspor tidak ikut terhapus saat reset aplikasi.")},confirmButton={TextButton(onClick={exportFormat=null;export(format)}){Text("Pilih tujuan ekspor")}},dismissButton={TextButton(onClick={exportFormat=null}){Text("Batal")}}) }
        deleting?.let { id -> AlertDialog(onDismissRequest={deleting=null},title={Text("Hapus catatan lokal?")},text={Text("Catatan di perangkat ini akan dihapus. Salinan ekspor di luar aplikasi tidak dihapus.")},confirmButton={TextButton(onClick={deleting=null;vm.delete(id)}){Text("Hapus")}},dismissButton={TextButton(onClick={deleting=null}){Text("Batal")}}) }
        if(resetting)AlertDialog(onDismissRequest={resetting=false},title={Text("Reset seluruh workspace?")},text={Text("Semua catatan, kunci enkripsi, dan model lokal di aplikasi akan dihapus. Tindakan ini tidak memulihkan data atau menghapus ekspor eksternal.")},confirmButton={TextButton(onClick={resetting=false;vm.reset()}){Text("Reset lokal")}},dismissButton={TextButton(onClick={resetting=false}){Text("Batal")}})
    }
}

@Composable private fun ExaminationForm(vm: SonriViewModel,record: ResearchRecord) {
    val exam=record.examination;val enabled=record.review==null && !vm.busy && vm.consentReady()
    Hint("Semua isian berikut berasal dari peninjau manusia dan terpisah dari temuan AI.")
    Field("Tanda dan gejala",exam.signsSymptoms,enabled){v->vm.updateExam{it.copy(signsSymptoms=v)}}
    Field("Riwayat kesehatan / obat / alergi",exam.medicalHistory,enabled){v->vm.updateExam{it.copy(medicalHistory=v)}}
    Field("Pemeriksaan mukosa",exam.mucosa,enabled){v->vm.updateExam{it.copy(mucosa=v)}}
    Field("Pemeriksaan periodontal",exam.periodontal,enabled){v->vm.updateExam{it.copy(periodontal=v)}}
    Field("Catatan klinis riset",exam.clinicalNotes,enabled){v->vm.updateExam{it.copy(clinicalNotes=v)}}
    Check("Orientasi dan konteks anatomis diketahui oleh peninjau",exam.orientationKnown,enabled){v->vm.updateExam{it.copy(orientationKnown=v)}}
    vm.catalog.examination_labels.forEach { (key,label) -> Check(label,exam.completedExams[key]==true,enabled){v->vm.updateExam{it.copy(completedExams=it.completedExams+(key to v))}} }
    Action("Odontogram FDI",enabled,{vm.screen=Screen.ODONTOGRAM})
    Action("Katalog dan kandidat manual",enabled,{vm.screen=Screen.TERMS})
    Action("Simpan terenkripsi",vm.consentReady() && !vm.busy,{try{vm.save()}catch(_:Exception){vm.notice("Penyimpanan gagal; periksa isian dan kapasitas lokal.")}})
    if(record.review!=null)Action("Buka revisi catatan riset",!vm.busy,vm::reopen)
}

@Composable private fun Odontogram(vm: SonriViewModel,record: ResearchRecord) {
    var selected by remember { mutableStateOf("16") };val exam=record.examination;val enabled=record.review==null && !vm.busy
    Hint("Penomoran FDI dipilih manual. Gigi yang belum dinilai tidak dianggap sehat.")
    Row(Modifier.horizontalScroll(rememberScrollState())) { listOf("PERMANENT","PRIMARY","MIXED").forEach { kind -> FilterChip(exam.dentition==kind,{selected=if(kind=="PRIMARY")"55" else "16";vm.updateExam{it.copy(dentition=kind)}},label={Text(kind)},enabled=enabled && exam.teeth.isEmpty(),modifier=Modifier.padding(end=8.dp)) } }
    if(exam.teeth.isNotEmpty())Hint("Dentisi dikunci setelah odontogram diisi agar observasi tidak terhapus. Gunakan pemeriksaan baru bila dentisi perlu diubah.")
    val rows=when(exam.dentition) {"PRIMARY"->DentalRules.primary;"MIXED"->DentalRules.permanent+DentalRules.primary;else->DentalRules.permanent}
    rows.forEach { row -> Row(Modifier.horizontalScroll(rememberScrollState())) { row.forEach { fdi ->
        val tooth=exam.teeth.find{it.fdi==fdi};val color=if(tooth?.status in setOf("FINDING","MISSING"))Color(0xFFFFE5B4) else Color(0xFFE6F1EF)
        OutlinedButton(onClick={selected=fdi},modifier=Modifier.padding(2.dp).sizeIn(minWidth=52.dp,minHeight=52.dp).testTag("tooth-$fdi"),colors=ButtonDefaults.outlinedButtonColors(containerColor=if(selected==fdi)Color(0xFFB8DDD7) else color)) {Text(fdi)}
    } } }
    val tooth=exam.teeth.find{it.fdi==selected} ?: Tooth(selected)
    fun change(update: (Tooth)->Tooth) { vm.updateExam { current -> current.copy(teeth=current.teeth.filterNot{it.fdi==selected}+update(tooth)) } }
    Text("Gigi FDI $selected • ${tooth.status}")
    Row(Modifier.horizontalScroll(rememberScrollState())) { DentalRules.statuses.forEach { status -> FilterChip(tooth.status==status,{change{it.copy(status=status)}},label={Text(status)},enabled=enabled,modifier=Modifier.padding(end=6.dp)) } }
    DentalRules.surfaces.forEach { surface -> Check(surface,surface in tooth.surfaces,enabled){checked->change{it.copy(surfaces=if(checked)(it.surfaces+surface).distinct() else it.surfaces-surface)}} }
    Field("Observasi manual FDI $selected",tooth.observation,enabled){value->change{it.copy(observation=value.take(1000))}}
    Action("Kembali ke form",action={vm.screen=Screen.EXAM})
}

@Composable fun BoxOverlay(bitmap: android.graphics.Bitmap,findings: List<RawFinding>) {
    val picture=remember(bitmap){bitmap.asImageBitmap()}
    Canvas(Modifier.fillMaxWidth().height(320.dp).testTag("bounding-boxes")) {
        val fit=DetrMath.fit(bitmap.width,bitmap.height,size.width,size.height)
        drawImage(picture,srcSize=androidx.compose.ui.unit.IntSize(bitmap.width,bitmap.height),dstOffset=androidx.compose.ui.unit.IntOffset(fit.left.toInt(),fit.top.toInt()),dstSize=androidx.compose.ui.unit.IntSize(fit.width.toInt(),fit.height.toInt()))
        val paint=Paint().apply {color=android.graphics.Color.YELLOW;textSize=13.sp.toPx();isAntiAlias=true}
        findings.forEach { f ->
            val left=fit.left+f.box[0]*fit.width;val top=fit.top+f.box[1]*fit.height
            drawRect(Color.Yellow,androidx.compose.ui.geometry.Offset(left,top),androidx.compose.ui.geometry.Size((f.box[2]-f.box[0])*fit.width,(f.box[3]-f.box[1])*fit.height),style=androidx.compose.ui.graphics.drawscope.Stroke(2.dp.toPx()))
            drawIntoCanvas{it.nativeCanvas.drawText("Area ${findings.indexOf(f)+1}",left,maxOf(fit.top+paint.textSize,top),paint)}
        }
    }
}

@Composable private fun DeviceInformation() {
    val context=LocalContext.current
    val memory=remember { ActivityManager.MemoryInfo().also { context.getSystemService(ActivityManager::class.java).getMemoryInfo(it) } }
    Text("${Build.MANUFACTURER} ${Build.MODEL}\nAndroid ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})\nABI: ${Build.SUPPORTED_ABIS.joinToString()}\nRAM OS: %.2f GiB\nAPK ${BuildConfig.VERSION_NAME}".format(Locale.US,memory.totalMem/1073741824.0))
    Hint("Dukungan awal Android 10+ ARM64. x86_64 ditujukan emulator. Ponsel fisik 4/6/8 GB, baterai, suhu, p50/p95 dan batas 15 detik belum diklaim lulus sebelum benchmark nyata. Tidak ada analytics atau crash upload.")
}
