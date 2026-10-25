package id.sonri.offline.data

import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import id.sonri.offline.core.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.OutputStream

@Serializable data class ResearchReport(val schemaVersion: String = "sonri.offline.report.v1",
    val clinicalUse: String = CLINICAL_USE, val clinicalValidation: String = "NOT_ESTABLISHED",
    val professionalIdentity: String = "NOT_VERIFIED_LOCALLY", val sourceImagesIncluded: Boolean = false,
    val record: ResearchRecord, val terminologyVersion: String = TERMINOLOGY_VERSION,
    val limitations: List<String> = listOf("Prototipe riset; bukan dasar terapi atau diagnosis otonom.",
        "Label AI UNVERIFIED. Nol deteksi bukan bukti sehat.","Diagnosis dipilih dan dimasukkan peninjau lokal; identitas profesi tidak diverifikasi.",
        "Kehilangan perangkat atau kunci dapat menghilangkan catatan. Ekspor hanya atas pilihan pengguna."))
object Reports {
    fun create(record: ResearchRecord): ResearchReport { DentalRules.validate(record);return ResearchReport(record=record) }
    fun json(record: ResearchRecord): String = Json { prettyPrint=true;encodeDefaults=true }.encodeToString(create(record))
    fun pdf(record: ResearchRecord,output: OutputStream) {
        val report=create(record)
        val lines=buildList {
            add("SONRI - LAPORAN RISET OFFLINE");add("PENGGUNAAN KLINIS: PROHIBITED");add("Validasi klinis: NOT_ESTABLISHED")
            add("ID lokal: ${record.id}");add("Alias riset: ${record.alias}");add("Versi: ${record.version}; ${record.updatedAt}")
            add("Data: ${record.dataKind}; persetujuan riset: ${record.researchConsent}")
            add("Katalog: $TERMINOLOGY_VERSION; 108 kode bukan 108 kemampuan AI")
            add("TEMUAN VISUAL AI MENTAH - UNVERIFIED")
            record.ai?.let { ai ->
                add("Model SHA-256: ${ai.modelSha256}");add("${ai.runtime}; ${ai.provider}")
                add("Waktu inferensi: %.1f ms; total: %.1f ms".format(ai.inferenceMs,ai.totalMs))
                ai.findings.forEach { add("${it.rawLabel}; skor mentah %.4f; kotak ${it.box}".format(it.score)) }
                if(ai.findings.isEmpty())add("Nol deteksi tidak membuktikan sehat.")
            } ?: add("Inferensi belum dijalankan.")
            add("PEMERIKSAAN YANG DIMASUKKAN LOKAL")
            add("Tanda/gejala: ${record.examination.signsSymptoms}");add("Riwayat: ${record.examination.medicalHistory}")
            add("Mukosa: ${record.examination.mucosa}");add("Periodontal: ${record.examination.periodontal}");add("Catatan: ${record.examination.clinicalNotes}")
            record.examination.teeth.forEach { add("FDI ${it.fdi}; ${it.status}; ${it.surfaces}; ${it.observation}") }
            add("KANDIDAT MANUAL: ${record.candidateCode.ifBlank { "Belum dipilih" }}")
            record.review?.let { add("DIAGNOSIS DIMASUKKAN PENINJAU: ${it.code}");add("Peninjau lokal: ${it.reviewerAlias}; identitas profesi BELUM DIVERIFIKASI");add("Bukti pemeriksaan: ${it.evidence}");add("Waktu: ${it.reviewedAt}") } ?: add("Belum direview lokal.")
            addAll(report.limitations)
            add("JEJAK AUDIT LOKAL");record.audit.forEach { add("${it.at}; v${it.recordVersion}; ${it.action}") }
        }.flatMap { it.replace(Regex("[\\r\\n\\t]+")," ").chunked(87) }
        val document=PdfDocument()
        try {
            val paint=Paint().apply { textSize=10f;isAntiAlias=true }
            lines.chunked(48).forEachIndexed { index,pageLines ->
                val page=document.startPage(PdfDocument.PageInfo.Builder(595,842,index+1).create())
                pageLines.forEachIndexed { row,line -> page.canvas.drawText(line,36f,42f+row*15,paint) }
                document.finishPage(page)
            }
            document.writeTo(output)
        } finally { document.close() }
    }
}
