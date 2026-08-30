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

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: contents,
      config: {
        systemInstruction: systemInstruction || undefined,
      },
    });

    const responseText = response.text || "";
    return NextResponse.json({ text: responseText, success: true });
  } catch (error: any) {
    console.error("Gemini Consultation API Error:", error);
    return NextResponse.json(
      { error: error?.message || "Terjadi kesalahan saat konsultasi dengan Gemini AI.", success: false },
      { status: 500 }
    );
  }
}
