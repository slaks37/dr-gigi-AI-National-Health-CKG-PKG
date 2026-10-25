package id.sonri.offline.inference

import java.io.File

/** Connectivity never changes the inference provider. Remote execution is explicitly unavailable. */
interface InferenceProvider {
    fun analyze(model:File,image:ResearchImage,hashMs:Double=0.0):EngineRun
    fun cancel()
}
class UnconfiguredConnectedInference:InferenceProvider {
    override fun analyze(model:File,image:ResearchImage,hashMs:Double):EngineRun=error("CONNECTED_INFERENCE_NOT_CONFIGURED_OR_APPROVED")
    override fun cancel(){}
}
