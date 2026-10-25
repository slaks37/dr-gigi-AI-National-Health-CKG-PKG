package id.sonri.offline.core

import java.nio.FloatBuffer
import kotlin.math.*

object DetrMath {
    private val mean=floatArrayOf(.485f,.456f,.406f)
    private val std=floatArrayOf(.229f,.224f,.225f)
    fun preprocess(pixels: IntArray,width: Int,height: Int,side: Int=INPUT_SIDE): FloatBuffer {
        require(width>0 && height>0 && pixels.size==width*height && side in 1..INPUT_SIDE)
        val data=java.nio.ByteBuffer.allocateDirect(side*side*3*4).order(java.nio.ByteOrder.nativeOrder()).asFloatBuffer()
        for(y in 0 until side) {
            val sy=max(0f,(y+.5f)*height/side-.5f); val y0=sy.toInt(); val y1=min(y0+1,height-1); val fy=sy-y0
            for(x in 0 until side) {
                val sx=max(0f,(x+.5f)*width/side-.5f);val x0=sx.toInt();val x1=min(x0+1,width-1);val fx=sx-x0
                val a=pixels[y0*width+x0];val b=pixels[y0*width+x1];val c=pixels[y1*width+x0];val d=pixels[y1*width+x1]
                for(channel in 0..2) {
                    val shift=16-8*channel
                    val top=((a ushr shift) and 255)*(1-fx)+((b ushr shift) and 255)*fx
                    val bottom=((c ushr shift) and 255)*(1-fx)+((d ushr shift) and 255)*fx
                    val value=(top*(1-fy)+bottom*fy)/255f
                    data.put(channel*side*side+y*side+x,(value-mean[channel])/std[channel])
                }
            }
        }
        data.rewind();return data
    }
    fun decode(boxes: FloatArray,logits: FloatArray): List<RawFinding> {
        require(boxes.size==1200 && logits.size==1500 && boxes.all(Float::isFinite) && logits.all(Float::isFinite)) { "RFDETR_OUTPUT_CONTRACT_MISMATCH" }
        val probabilities=DoubleArray(1500) { 1.0/(1.0+exp(-logits[it].toDouble().coerceIn(-700.0,700.0))) }
        val pairs=probabilities.indices.sortedWith(compareByDescending<Int> { probabilities[it] }.thenBy { it }).take(300).filter { probabilities[it]>.25 }
        require(pairs.size<=200) { "DETECTION_LIMIT_EXCEEDED" }
        return pairs.map { index ->
            val query=index/5;val cid=index%5;val offset=query*4
            val cx=boxes[offset];val cy=boxes[offset+1];val w=boxes[offset+2];val h=boxes[offset+3]
            require(w>0 && h>0) { "INVALID_MODEL_BOX" }
            val box=listOf(max(0f,cx-w/2),max(0f,cy-h/2),min(1f,cx+w/2),min(1f,cy+h/2))
            require(box.all { it.isFinite() && it in 0f..1f } && box[0]<box[2] && box[1]<box[3]) { "INVALID_MODEL_BOX" }
            RawFinding(cid,probabilities[index],box)
        }
    }
    data class Fit(val left: Float,val top: Float,val width: Float,val height: Float)
    fun fit(imageWidth: Int,imageHeight: Int,canvasWidth: Float,canvasHeight: Float): Fit {
        require(imageWidth>0 && imageHeight>0 && canvasWidth>0 && canvasHeight>0)
        val scale=min(canvasWidth/imageWidth,canvasHeight/imageHeight)
        val w=imageWidth*scale;val h=imageHeight*scale
        return Fit((canvasWidth-w)/2,(canvasHeight-h)/2,w,h)
    }
    fun quality(pixels: IntArray,width: Int,height: Int): Quality {
        require(pixels.size==width*height && width>0 && height>0)
        val step=max(1,min(width,height)/128);val values=mutableListOf<Double>();val lap=mutableListOf<Double>()
        fun gray(x: Int,y: Int): Double { val p=pixels[y*width+x];return .299*((p ushr 16)and 255)+.587*((p ushr 8)and 255)+.114*(p and 255) }
        for(y in step until height-step step step)for(x in step until width-step step step) {
            val g=gray(x,y);values+=g;lap+=gray(x-step,y)+gray(x+step,y)+gray(x,y-step)+gray(x,y+step)-4*g
        }
        fun variance(v: List<Double>): Double { val m=v.average();return v.map { (it-m).pow(2) }.average() }
        val avg=values.takeIf { it.isNotEmpty() }?.average() ?: 0.0
        val contrast=if(values.isEmpty())0.0 else sqrt(variance(values));val sharp=if(lap.isEmpty())0.0 else variance(lap)
        val warnings=buildList {
            if(min(width,height)<224)add("Resolusi terlalu kecil")
            if(avg<35)add("Gambar gelap")
            if(avg>235)add("Gambar sangat terang")
            if(contrast<15)add("Kontras rendah")
            if(sharp<20)add("Detail rendah; periksa fokus secara manual")
            add("Kelayakan foto dental dan modalitas belum diverifikasi")
        }
        return Quality(width,height,avg,contrast,sharp,warnings)
    }
}
