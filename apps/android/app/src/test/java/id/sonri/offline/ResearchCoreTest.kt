package id.sonri.offline

import id.sonri.offline.core.*
import id.sonri.offline.data.Reports
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import kotlin.math.ln

class ResearchCoreTest {
    private fun bundle(): TerminologyBundle {
        val f=File("src/main/assets/terminology.v1.json")
        return Terminology.parse(f.readBytes(),File(f.path+".sha256").readText())
    }
    @Test fun completeVersionedOfflineCatalogAndTamperRejection() {
        val b=bundle();assertEquals(108,b.entries.count{it.kind=="TERMINAL"});assertEquals(15,b.entries.count{it.kind=="CATEGORY"})
        assertEquals(0,b.clinically_validated_codes);assertEquals("K04.0",Terminology.search(b,"K04.0").single().code)
        assertThrows(IllegalArgumentException::class.java) { Terminology.parse("changed".toByteArray(),"0".repeat(64)) }
    }
    @Test fun allFdiNumbersAreManualAndDentitionSpecific() {
        assertEquals(32,DentalRules.permanent.flatten().distinct().size);assertEquals(20,DentalRules.primary.flatten().distinct().size)
        assertTrue(DentalRules.validFdi("PERMANENT","16"));assertFalse(DentalRules.validFdi("PERMANENT","55"))
        assertTrue(DentalRules.validFdi("MIXED","55"));assertFalse(DentalRules.validFdi("PRIMARY","16"));assertFalse(DentalRules.validFdi("MIXED","99"))
        assertEquals("UNASSESSED",Tooth("16").status)
    }
    @Test fun halfPixelResizeNormalizesRgbToNchwWithoutAntialias() {
        val pixels=intArrayOf(0xff000000.toInt(),0xffff0000.toInt(),0xff00ff00.toInt(),0xffffffff.toInt())
        val t=DetrMath.preprocess(pixels,2,2,4)
        assertEquals((0f-.485f)/.229f,t[0],1e-6f)
        assertEquals((1f-.485f)/.229f,t[3],1e-6f)
        assertEquals((.25f-.485f)/.229f,t[1],1e-6f)
        assertEquals((0f-.456f)/.224f,t[16+3],1e-6f)
        assertEquals((1f-.406f)/.225f,t[32+15],1e-6f)
    }
    @Test fun retainRawSlotZeroAndMultiLabelQueryWithoutDiseaseBinding() {
        val boxes=FloatArray(1200);boxes[0]=.5f;boxes[1]=.5f;boxes[2]=.4f;boxes[3]=.2f
        val logits=FloatArray(1500){-20f};logits[0]=ln(4.0).toFloat();logits[4]=ln(3.0).toFloat()
        val f=DetrMath.decode(boxes,logits)
        assertEquals(listOf(0,4),f.map{it.classId});assertEquals("RAW_CLASS_0",f[0].rawLabel)
        assertEquals("UNVERIFIED",f[0].labelVerification);assertEquals(.3f,f[0].box[0],1e-6f)
    }
    @Test fun malformedOutputsNeverBecomeBoxes() {
        assertThrows(IllegalArgumentException::class.java){DetrMath.decode(FloatArray(4),FloatArray(5))}
        val boxes=FloatArray(1200);val logits=FloatArray(1500){-20f};logits[0]=Float.NaN
        assertThrows(IllegalArgumentException::class.java){DetrMath.decode(boxes,logits)}
        logits[0]=3f
        assertThrows(IllegalArgumentException::class.java){DetrMath.decode(boxes,logits)}
    }
    @Test fun noDetectionsDoNotConfirmHealthOrDiagnosis() {
        assertTrue(DetrMath.decode(FloatArray(1200),FloatArray(1500){-20f}).isEmpty())
        val r=ResearchRecord(researchConsent=true)
        assertNull(r.review);assertTrue(r.candidateCode.isEmpty());assertEquals("PROHIBITED",r.clinicalUse)
    }
    @Test fun displayGeometryPreservesImageAspectAndCoordinates() {
        val f=DetrMath.fit(400,200,300f,300f)
        assertEquals(0f,f.left,0f);assertEquals(75f,f.top,0f);assertEquals(300f,f.width,0f);assertEquals(150f,f.height,0f)
    }
    @Test fun consentAndIndependentManualReviewGate() {
        val term=bundle().entries.single{it.code=="K04.0"}
        val initial=ResearchRecord(researchConsent=true,examination=Examination(orientationKnown=true,completedExams=mapOf("clinical_exam" to true)))
        assertThrows(IllegalArgumentException::class.java){DentalRules.confirm(initial,term,"Riset","Bukti pemeriksaan untuk fixture sintetis",true)}
        val complete=initial.copy(examination=initial.examination.copy(completedExams=term.workflow.examinations.associateWith{true}))
        assertThrows(IllegalArgumentException::class.java){DentalRules.confirm(complete,term,"Riset","Bukti pemeriksaan untuk fixture sintetis",false)}
        val reviewed=DentalRules.confirm(complete,term,"Riset","Bukti pemeriksaan untuk fixture sintetis",true)
        assertEquals("K04.0",reviewed.review!!.code);assertEquals("SELF_ATTESTED_NOT_VERIFIED",reviewed.review!!.identityStatus);assertNull(reviewed.ai)
        assertThrows(IllegalArgumentException::class.java){DentalRules.validate(initial.copy(researchConsent=false))}
    }
    @Test fun reportSeparatesManualReviewAndRawAiAndEscapesInput() {
        val r=ResearchRecord(alias="synthetic\"\n<fixture>",researchConsent=true)
        val report=Reports.json(r)
        assertTrue(report.contains("NOT_ESTABLISHED"));assertTrue(report.contains("NOT_VERIFIED_LOCALLY"))
        assertTrue(report.contains("\\\"\\n"));assertFalse(report.contains("base64"));assertTrue(report.contains("\"sourceImagesIncluded\": false"))
    }
    @Test fun sha256KnownVectorAndInvalidOdontogram() {
        assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",sha256("abc".toByteArray()))
        assertThrows(IllegalArgumentException::class.java){DentalRules.validate(ResearchRecord(researchConsent=true,examination=Examination(teeth=listOf(Tooth("99")))))}
    }
}
