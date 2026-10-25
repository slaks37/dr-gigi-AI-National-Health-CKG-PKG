package id.sonri.offline.inference

import ai.onnxruntime.*
import id.sonri.offline.core.*
import java.io.File
import java.util.concurrent.atomic.AtomicReference
import java.util.concurrent.atomic.AtomicInteger

data class EngineRun(val evidence: InferenceEvidence,val boxes: FloatArray,val logits: FloatArray)
class OnDeviceEngine:InferenceProvider {
    private val active=AtomicReference<OrtSession.RunOptions?>()
    private val generation=AtomicInteger()
    override fun cancel() { generation.incrementAndGet();try { active.get()?.setTerminate(true) } catch(_: Exception) { /* no sensitive exception payload */ } }
    @Synchronized override fun analyze(model: File,image: ResearchImage,hashMs: Double): EngineRun {
        val ticket=generation.get()
        val totalStart=System.nanoTime();val env=OrtEnvironment.getEnvironment(OrtLoggingLevel.ORT_LOGGING_LEVEL_FATAL,"sonri-offline")
        val loadStart=System.nanoTime()
        OrtSession.SessionOptions().use { options ->
            options.setIntraOpNumThreads(2);options.setInterOpNumThreads(1)
            options.setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT)
            env.createSession(model.path,options).use { session ->
                val loadMs=(System.nanoTime()-loadStart)/1e6
                check(generation.get()==ticket) { "INFERENCE_CANCELLED" }
                require(session.inputNames==setOf("input") && session.outputNames==setOf("dets","labels")) { "MODEL_NODE_CONTRACT_MISMATCH" }
                fun tensor(node: NodeInfo,wanted: LongArray) { val info=node.info as? TensorInfo ?: error("MODEL_TENSOR_REQUIRED");require(info.type==OnnxJavaType.FLOAT && info.shape.contentEquals(wanted)) { "MODEL_SHAPE_MISMATCH" } }
                tensor(session.inputInfo.getValue("input"),longArrayOf(1,3,704,704))
                tensor(session.outputInfo.getValue("dets"),longArrayOf(1,300,4));tensor(session.outputInfo.getValue("labels"),longArrayOf(1,300,5))
                val start=System.nanoTime();val b=image.bitmap;val pixels=IntArray(b.width*b.height);b.getPixels(pixels,0,b.width,0,0,b.width,b.height)
                val buffer=DetrMath.preprocess(pixels,b.width,b.height);val preprocessMs=(System.nanoTime()-start)/1e6
                OnnxTensor.createTensor(env,buffer,longArrayOf(1,3,704,704)).use { input ->
                    OrtSession.RunOptions().use { runOptions ->
                        active.set(runOptions)
                        try {
                            check(generation.get()==ticket) { "INFERENCE_CANCELLED" }
                            val inferenceStart=System.nanoTime()
                            session.run(mapOf("input" to input),runOptions).use { result ->
                                val inferenceMs=(System.nanoTime()-inferenceStart)/1e6
                                val boxes=FloatArray(1200);val logits=FloatArray(1500)
                                (result.get("dets").get() as OnnxTensor).floatBuffer.get(boxes)
                                (result.get("labels").get() as OnnxTensor).floatBuffer.get(logits)
                                val findings=DetrMath.decode(boxes,logits)
                                return EngineRun(InferenceEvidence(runtime="ONNX Runtime ${env.version}",
                                    imageSha256=image.sourceSha256,width=b.width,height=b.height,hashMs=hashMs,loadMs=loadMs,
                                    preprocessMs=preprocessMs,inferenceMs=inferenceMs,totalMs=(System.nanoTime()-totalStart)/1e6+hashMs,findings=findings),boxes,logits)
                            }
                        } finally { active.compareAndSet(runOptions,null) }
                    }
                }
            }
        }
    }
}
