import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { isAgnesConfigured, callAgnesAnalyze } from "@/app/lib/agnesAi";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

let aiClient: GoogleGenAI | null = null;
function getAI() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return null;
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

const CANDIDATE_MODELS = [
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-3.8-flash",
  "gemini-3.1-flash-lite",
];

export async function POST(req: NextRequest) {
  try {
    const { systemInstruction, prompt, images } = await req.json();

    const parts: any[] = [];

    if (Array.isArray(images)) {
      for (const img of images) {
        if (!img) continue;
        let base64Data = img.data || img.url || '';
        let mimeType = img.mimeType || 'image/jpeg';

        if (base64Data.startsWith('data:')) {
          const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            mimeType = match[1];
            base64Data = match[2];
          } else {
            base64Data = base64Data.split(',')[1] || '';
          }
        }

        let cleanMime = (mimeType || 'image/jpeg').split(';')[0].trim().toLowerCase();
        if (cleanMime === 'image/jpg') cleanMime = 'image/jpeg';

        if (base64Data) {
          parts.push({
            inlineData: {
              mimeType: cleanMime,
              data: base64Data,
            },
          });
        }
      }
    }

    if (prompt) {
      parts.push({ text: prompt });
    }

    if (parts.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada konten atau gambar yang diberikan.", success: false },
        { status: 400 }
      );
    }

    let lastError: any = null;

    // 1. PRIMARY: Prioritize Agnes AI when configured (per user request)
    if (isAgnesConfigured()) {
      try {
        console.log("[Primary Engine] Memproses analisis foto menggunakan Agnes AI...");
        const agnesResult = await callAgnesAnalyze({
          systemInstruction,
          prompt,
          images
        });

        if (agnesResult && agnesResult.trim().length > 0) {
          console.log("[Agnes AI Success] Analisis berhasil diproses oleh Agnes AI.");
          return NextResponse.json({ 
            result: agnesResult, 
            success: true, 
            provider: 'agnes-ai' 
          });
        }
      } catch (agnesErr: any) {
        console.warn("[Agnes AI Failed] Percobaan Agnes AI dialihkan ke fallback Gemini:", agnesErr?.message || agnesErr);
        lastError = agnesErr;
      }
    }

    // 2. FALLBACK / ALTERNATIVE: Gemini AI
    let response: any = null;
    const ai = getAI();

    if (ai) {
      console.log("[Fallback Engine] Mencoba model Gemini...");
      for (const model of CANDIDATE_MODELS) {
        try {
          response = await ai.models.generateContent({
            model,
            contents: parts,
            config: {
              systemInstruction: systemInstruction || undefined,
              responseMimeType: "application/json",
            },
          });
          if (response && response.text) {
            break;
          }
        } catch (err: any) {
          console.warn(`[Gemini] Model ${model} failed, trying next fallback:`, err?.message || err);
          lastError = err;
        }
      }
    } else {
      if (!lastError) {
        lastError = new Error("GEMINI_API_KEY tidak tersedia di server.");
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error("Semua model AI (Agnes AI & Gemini) sedang sibuk. Silakan coba beberapa saat lagi.");
    }

    let responseText = (response.text || "{}").trim();
    if (responseText.includes('```json')) {
      const match = responseText.match(/```json\s*([\s\S]*?)\s*```/i);
      if (match) {
        responseText = match[1].trim();
      }
    } else if (responseText.includes('```')) {
      const match = responseText.match(/```\s*([\s\S]*?)\s*```/i);
      if (match) {
        responseText = match[1].trim();
      }
    }

    // Try finding JSON boundary if there are stray characters
    try {
      JSON.parse(responseText);
    } catch {
      const firstBrace = responseText.indexOf('{');
      const lastBrace = responseText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        responseText = responseText.substring(firstBrace, lastBrace + 1);
      }
    }

    return NextResponse.json({ result: responseText, success: true, provider: 'gemini' });
  } catch (error: any) {
    console.error("Analysis API Error:", error);
    return NextResponse.json(
      { error: error?.message || "Terjadi kesalahan saat memproses analisis AI.", success: false },
      { status: 500 }
    );
  }
}
