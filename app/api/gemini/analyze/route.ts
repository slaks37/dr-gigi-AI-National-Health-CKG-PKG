import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

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

        if (base64Data) {
          parts.push({
            inlineData: {
              mimeType,
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

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: parts,
      config: {
        systemInstruction: systemInstruction || undefined,
        responseMimeType: "application/json",
      },
    });

    const responseText = response.text || "{}";
    return NextResponse.json({ result: responseText, success: true });
  } catch (error: any) {
    console.error("Gemini Analysis API Error:", error);
    return NextResponse.json(
      { error: error?.message || "Terjadi kesalahan saat memproses analisis dengan Gemini AI.", success: false },
      { status: 500 }
    );
  }
}
