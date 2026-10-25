package id.sonri.offline.core

import kotlinx.serialization.Serializable
import java.security.MessageDigest
import java.time.Instant
import java.util.UUID

const val CLINICAL_USE = "PROHIBITED"
const val TERMINOLOGY_VERSION = "WHO-ICD10-2010"
const val RFDETR_SHA256 = "a73a2bb52bca024f98bcddc446fed57e4c3b1296558c6eddb6dc87f0d9c7f5e0"
const val RFDETR_BYTES = 121573930L
const val INPUT_SIDE = 704

fun sha256(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }

@Serializable data class RawFinding(
    val classId: Int, val score: Double, val box: List<Float>,
    val rawLabel: String = "RAW_CLASS_$classId", val labelVerification: String = "UNVERIFIED",
    val reviewStatus: String = "UNCONFIRMED",
) {
    init {
        require(classId in 0..4 && score.isFinite() && score in 0.0..1.0)
        require(rawLabel=="RAW_CLASS_$classId" && labelVerification=="UNVERIFIED" && reviewStatus=="UNCONFIRMED")
        require(box.size==4 && box.all { it.isFinite() && it in 0f..1f } && box[0]<box[2] && box[1]<box[3])
    }
}
@Serializable data class Quality(val width: Int, val height: Int, val meanBrightness: Double,
    val contrast: Double, val laplacianVariance: Double, val warnings: List<String>,
    val clinicalAdequacy: String = "NOT_ESTABLISHED")
@Serializable data class InferenceEvidence(
    val modelSha256: String = RFDETR_SHA256, val modelVersion: String = "dataset-v1-onnx-fp32",
    val runtime: String, val provider: String = "CPUExecutionProvider", val inputShape: List<Int> = listOf(1,3,704,704),
    val preprocessing: String = "RGB_HALF_PIXEL_BILINEAR_IMAGENET_NCHW_V1", val threshold: Double = 0.25,
    val imageSha256: String, val width: Int, val height: Int, val hashMs: Double, val loadMs: Double,
    val preprocessMs: Double, val inferenceMs: Double, val totalMs: Double, val findings: List<RawFinding>,
    val clinicalUse: String = CLINICAL_USE, val labelVerification: String = "UNVERIFIED",
    val negativeResultMeaning: String = "NO_DETECTION_IS_NOT_PROOF_OF_HEALTH",
)
@Serializable data class Tooth(val fdi: String, val status: String = "UNASSESSED", val surfaces: List<String> = emptyList(), val observation: String = "")
@Serializable data class Examination(
    val dentition: String = "PERMANENT", val orientationKnown: Boolean = false,
    val signsSymptoms: String = "", val medicalHistory: String = "", val mucosa: String = "",
    val periodontal: String = "", val clinicalNotes: String = "", val teeth: List<Tooth> = emptyList(),
    val completedExams: Map<String,Boolean> = emptyMap(),
)
@Serializable data class LocalReview(val code: String, val reviewerAlias: String, val evidence: String,
    val reviewedAt: String = Instant.now().toString(), val identityStatus: String = "SELF_ATTESTED_NOT_VERIFIED",
    val scope: String = "LOCAL_RESEARCH_REVIEW_ONLY", val terminologyVersion: String = TERMINOLOGY_VERSION)
@Serializable data class AuditEvent(val action: String, val at: String = Instant.now().toString(), val recordVersion: Int)
@Serializable data class ResearchRecord(
    val id: String = UUID.randomUUID().toString(), val alias: String = "Riset lokal",
    val createdAt: String = Instant.now().toString(), val updatedAt: String = Instant.now().toString(), val version: Int = 1,
    val dataKind: String = "SYNTHETIC", val researchConsent: Boolean = false, val permissionReference: String = "",
    val quality: Quality? = null, val ai: InferenceEvidence? = null, val examination: Examination = Examination(),
    val candidateCode: String = "", val review: LocalReview? = null, val audit: List<AuditEvent> = emptyList(),
    val clinicalUse: String = CLINICAL_USE, val clinicalValidation: String = "NOT_ESTABLISHED",
)
@Serializable data class VaultData(val schemaVersion: Int = 1, val records: List<ResearchRecord> = emptyList(),
    val modelPermissionReference: String = "", val retentionDays: Int = 30)

object DentalRules {
    val permanent = listOf((18 downTo 11).map(Int::toString), (21..28).map(Int::toString), (48 downTo 41).map(Int::toString), (31..38).map(Int::toString))
    val primary = listOf((55 downTo 51).map(Int::toString), (61..65).map(Int::toString), (85 downTo 81).map(Int::toString), (71..75).map(Int::toString))
    val statuses = listOf("UNASSESSED", "FINDING", "MISSING", "RESTORED")
    val surfaces = setOf("MESIAL", "DISTAL", "BUCCAL", "LINGUAL", "OCCLUSAL")
    fun validFdi(dentition: String, fdi: String): Boolean = fdi in when(dentition) {
        "PERMANENT" -> permanent.flatten(); "PRIMARY" -> primary.flatten(); "MIXED" -> permanent.flatten()+primary.flatten(); else -> emptyList()
    }
    fun validate(record: ResearchRecord) {
        require(record.clinicalUse == CLINICAL_USE && record.clinicalValidation == "NOT_ESTABLISHED") { "RESEARCH_SCOPE_REQUIRED" }
        require(record.researchConsent && record.dataKind in setOf("SYNTHETIC", "AUTHORIZED_NONPATIENT")) { "RESEARCH_CONSENT_REQUIRED" }
        require(record.dataKind == "SYNTHETIC" || record.permissionReference.trim().length >= 8) { "DATA_PERMISSION_REQUIRED" }
        require(record.alias.length <= 80 && record.permissionReference.length <= 300)
        require(record.examination.teeth.map { it.fdi }.distinct().size == record.examination.teeth.size)
        record.examination.teeth.forEach { require(validFdi(record.examination.dentition,it.fdi) && it.status in statuses && surfaces.containsAll(it.surfaces) && it.observation.length <= 1000) { "INVALID_ODONTOGRAM" } }
        require(listOf(record.examination.signsSymptoms,record.examination.medicalHistory,record.examination.mucosa,record.examination.periodontal,record.examination.clinicalNotes).all { it.length <= 4000 })
        record.ai?.let { require(it.modelSha256 == RFDETR_SHA256 && it.clinicalUse == CLINICAL_USE && it.labelVerification == "UNVERIFIED") }
        record.review?.let { require(it.scope == "LOCAL_RESEARCH_REVIEW_ONLY" && it.identityStatus == "SELF_ATTESTED_NOT_VERIFIED" && it.terminologyVersion == TERMINOLOGY_VERSION) }
    }
    fun confirm(record: ResearchRecord, entry: Term, reviewerAlias: String, evidence: String, selfAttestedDentist: Boolean): ResearchRecord {
        validate(record)
        require(entry.kind == "TERMINAL" && record.examination.orientationKnown) { "TERMINAL_CODE_AND_ORIENTATION_REQUIRED" }
        require(selfAttestedDentist && reviewerAlias.trim().length in 2..80 && evidence.trim().length in 20..4000) { "DOCUMENTED_LOCAL_REVIEW_REQUIRED" }
        require(entry.workflow.examinations.all { record.examination.completedExams[it] == true }) { "REQUIRED_EXAMINATIONS_MISSING" }
        return record.copy(review=LocalReview(entry.code,reviewerAlias.trim(),evidence.trim()))
    }
    fun changed(record: ResearchRecord, action: String): ResearchRecord {
        val version = record.version + 1
        return record.copy(version=version,updatedAt=Instant.now().toString(),audit=(record.audit+AuditEvent(action,recordVersion=version)).takeLast(200))
    }
}
