import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { isAgnesConfigured, callAgnesConsultation } from "@/app/lib/agnesAi";

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
    const { systemInstruction, messages, currentMessage } = await req.json();

    const contents: any[] = [];

    if (Array.isArray(messages)) {
      for (const m of messages) {
        const role = m.role === 'model' || m.role === 'assistant' ? 'model' : 'user';
        const parts: any[] = [];

        if (m.text) {
          parts.push({ text: m.text });
        }

        if (m.image) {
          let base64Data = m.image;
          let mimeType = 'image/jpeg';
          if (base64Data.startsWith('data:')) {
            const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              mimeType = match[1];
              base64Data = match[2];
            } else {
              base64Data = base64Data.split(',')[1] || '';
            }
          }
          if (base64Data) {
            parts.push({
              inlineData: {
                mimeType,
                data: base64Data,
              },
            });
          }
        }

        if (parts.length > 0) {
          contents.push({ role, parts });
        }
      }
    }

    if (currentMessage) {
      const parts: any[] = [];
      if (currentMessage.text) {
        parts.push({ text: currentMessage.text });
      }
      if (currentMessage.image) {
        let base64Data = currentMessage.image;
        let mimeType = 'image/jpeg';
        if (base64Data.startsWith('data:')) {
          const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            mimeType = match[1];
            base64Data = match[2];
          } else {
            base64Data = base64Data.split(',')[1] || '';
          }
        }
        if (base64Data) {
          parts.push({
            inlineData: {
              mimeType,
              data: base64Data,
            },
          });
        }
      }

      if (parts.length > 0) {
        contents.push({ role: 'user', parts });
      }
    }

    if (contents.length === 0) {
      return NextResponse.json(
        { error: "Pesan tidak boleh kosong.", success: false },
        { status: 400 }
      );
    }

    let lastError: any = null;

    // 1. PRIMARY: Prioritize Agnes AI when configured
    if (isAgnesConfigured()) {
      try {
        console.log("[Primary Engine] Memproses konsultasi menggunakan Agnes AI...");
        const agnesText = await callAgnesConsultation({
          systemInstruction,
          messages,
          currentMessage
        });

        if (agnesText && agnesText.trim().length > 0) {
          console.log("[Agnes AI Success] Konsultasi berhasil diproses oleh Agnes AI.");
          return NextResponse.json({ text: agnesText, success: true, provider: 'agnes-ai' });
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
      console.log("[Fallback Engine] Mencoba model Gemini untuk konsultasi...");
      for (const model of CANDIDATE_MODELS) {
        try {
          response = await ai.models.generateContent({
            model,
            contents: contents,
            config: {
              systemInstruction: systemInstruction || undefined,
            },
          });
          if (response && response.text) {
            break;
          }
        } catch (err: any) {
          console.warn(`[Gemini Consultation] Model ${model} failed, trying fallback:`, err?.message || err);
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

    const responseText = response.text || "";
    return NextResponse.json({ text: responseText, success: true, provider: 'gemini' });
  } catch (error: any) {
    console.error("Consultation API Error:", error);
    return NextResponse.json(
      { error: error?.message || "Terjadi kesalahan saat konsultasi dengan AI.", success: false },
      { status: 500 }
    );
  }
}
