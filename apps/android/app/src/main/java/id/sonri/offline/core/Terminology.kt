package id.sonri.offline.core

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive

@Serializable data class Workflow(
    val examinations: List<String>, val clinical_details: List<String>, val conditional_examinations: List<String>,
    val differential_codes: List<String>, val limitations: List<String>,
)
@Serializable data class Term(val code: String, @SerialName("official_title") val title: String,
    val kind: String, val source: String, val workflow: Workflow,
    @SerialName("official_inclusions") val inclusions: List<String> = emptyList(),
    @SerialName("official_exclusions") val exclusions: List<String> = emptyList(),
    @SerialName("official_notes") val notes: List<String> = emptyList())
@Serializable data class TerminologyBundle(val schema_version: String, val source_catalog_sha256: String,
    val terminology: JsonObject, val examination_labels: Map<String,String>, val entries: List<Term>,
    val clinical_use: String, val ai_supported_codes: Int, val ai_evaluated_codes: Int, val clinically_validated_codes: Int)
object Terminology {
    private val json = Json { ignoreUnknownKeys=true }
    fun parse(bytes: ByteArray, expectedSha256: String): TerminologyBundle {
        require(sha256(bytes) == expectedSha256.trim()) { "TERMINOLOGY_HASH_MISMATCH" }
        val b = json.decodeFromString<TerminologyBundle>(bytes.toString(Charsets.UTF_8))
        require(b.schema_version == "sonri.android-terminology.v1" && b.terminology["version"]?.jsonPrimitive?.content == TERMINOLOGY_VERSION)
        require(b.entries.map { it.code }.distinct().size == b.entries.size && b.entries.count { it.kind=="TERMINAL" }==108 && b.entries.count { it.kind=="CATEGORY" }==15)
        require(b.clinical_use == CLINICAL_USE && b.ai_supported_codes == 0 && b.ai_evaluated_codes == 0 && b.clinically_validated_codes == 0)
        require(b.entries.all { it.workflow.examinations.isNotEmpty() && b.examination_labels.keys.containsAll(it.workflow.examinations) })
        return b
    }
    fun search(bundle: TerminologyBundle, query: String): List<Term> = bundle.entries.filter { query.isBlank() || it.code.contains(query,true) || it.title.contains(query,true) }
    fun missing(entry: Term, exam: Examination): List<String> = entry.workflow.examinations.filter { exam.completedExams[it] != true }
}
