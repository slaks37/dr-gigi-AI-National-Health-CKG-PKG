/**
 * Failover Client for Agnes AI (https://platform.agnes-ai.com)
 * OpenAI-compatible multimodal endpoint: https://apihub.agnes-ai.com/v1/chat/completions
 * Used as high-reliability failover when Gemini API encounters rate limits, 503 high-demand, or quota limits.
 */

export interface AgnesImagePart {
  data?: string;
  url?: string;
  mimeType?: string;
}

export function isAgnesConfigured(): boolean {
  return !!process.env.AGNES_API_KEY && process.env.AGNES_API_KEY.trim().length > 0;
}

export function getAgnesBaseUrl(): string {
  const url = process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com/v1';
  return url.replace(/\/+$/, '');
}

export function normalizeAgnesModel(raw?: string): string {
  if (!raw) return 'agnes-2.5-flash';
  const clean = raw.trim().toLowerCase().replace(/\s+/g, '-');
  if (clean.includes('2.5') && clean.includes('pro')) return 'agnes-2.5-pro';
  if (clean.includes('3.0') || clean === 'agnes-3-flash') return 'agnes-3.0-flash';
  if (clean.includes('2.0') || clean === 'agnes-2-flash') return 'agnes-2.0-flash';
  if (clean.includes('2.5') || clean.includes('flash')) return 'agnes-2.5-flash';
  return clean || 'agnes-2.5-flash';
}

export function getAgnesCandidateModels(): string[] {
  const configured = normalizeAgnesModel(process.env.AGNES_MODEL);
  const fallbacks = ['agnes-2.5-flash', 'agnes-3.0-flash', 'agnes-2.0-flash', 'agnes-2.5-pro'];
  return Array.from(new Set([configured, ...fallbacks]));
}

/**
 * Executes a multimodal analysis via Agnes AI (OpenAI-compatible format)
 */
export async function callAgnesAnalyze({
  systemInstruction,
  prompt,
  images = []
}: {
  systemInstruction?: string;
  prompt: string;
  images?: AgnesImagePart[];
}): Promise<string> {
  const apiKey = process.env.AGNES_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("AGNES_API_KEY belum dikonfigurasi pada environment / Settings.");
  }

  const baseUrl = getAgnesBaseUrl();
  const models = getAgnesCandidateModels();

  const userContentParts: any[] = [];
  if (prompt) {
    userContentParts.push({ type: 'text', text: prompt });
  }

  for (const img of images) {
    if (!img) continue;
    let base64Data = img.data || img.url || '';
    let mimeType = img.mimeType || 'image/jpeg';

    if (base64Data.startsWith('data:')) {
      userContentParts.push({
        type: 'image_url',
        image_url: { url: base64Data }
      });
    } else if (base64Data.startsWith('http://') || base64Data.startsWith('https://')) {
      userContentParts.push({
        type: 'image_url',
        image_url: { url: base64Data }
      });
    } else if (base64Data) {
      let cleanMime = (mimeType || 'image/jpeg').split(';')[0].trim().toLowerCase();
      if (cleanMime === 'image/jpg') cleanMime = 'image/jpeg';
      userContentParts.push({
        type: 'image_url',
        image_url: { url: `data:${cleanMime};base64,${base64Data}` }
      });
    }
  }

  const messages: any[] = [];
  if (systemInstruction) {
    messages.push({
      role: 'system',
      content: systemInstruction
    });
  }

  messages.push({
    role: 'user',
    content: userContentParts.length === 1 && userContentParts[0].type === 'text' 
      ? userContentParts[0].text 
      : userContentParts
  });

  let lastError: any = null;

  for (const model of models) {
    try {
      console.log(`[Agnes AI] Memproses analisis foto dengan model: ${model}`);
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.2,
          max_tokens: 3000
        }),
        signal: AbortSignal.timeout(50000)
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`Agnes AI returned HTTP ${res.status}: ${errorText}`);
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content === 'string' && content.trim().length > 0) {
        let cleaned = content.trim();
        if (cleaned.startsWith('```json')) {
          cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
        } else if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/, '');
        }
        return cleaned;
      }
      throw new Error("Agnes AI mengembalikan respon kosong.");
    } catch (err: any) {
      console.warn(`[Agnes AI] Model ${model} failed:`, err?.message || err);
      lastError = err;
    }
  }

  throw lastError || new Error("Gagal memproses dengan Agnes AI.");
}

/**
 * Executes a conversation/consultation via Agnes AI (OpenAI-compatible format)
 */
export async function callAgnesConsultation({
  systemInstruction,
  messages = [],
  currentMessage
}: {
  systemInstruction?: string;
  messages?: any[];
  currentMessage?: { text?: string; image?: string };
}): Promise<string> {
  const apiKey = process.env.AGNES_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("AGNES_API_KEY belum dikonfigurasi pada environment / Settings.");
  }

  const baseUrl = getAgnesBaseUrl();
  const models = getAgnesCandidateModels();

  const formattedMessages: any[] = [];
  if (systemInstruction) {
    formattedMessages.push({
      role: 'system',
      content: systemInstruction
    });
  }

  for (const m of messages) {
    const role = m.role === 'model' || m.role === 'assistant' ? 'assistant' : 'user';
    const parts: any[] = [];

    if (m.text) {
      parts.push({ type: 'text', text: m.text });
    }

    if (m.image) {
      let imgUrl = m.image;
      if (!imgUrl.startsWith('data:') && !imgUrl.startsWith('http')) {
        imgUrl = `data:image/jpeg;base64,${imgUrl}`;
      }
      parts.push({
        type: 'image_url',
        image_url: { url: imgUrl }
      });
    }

    if (parts.length === 1 && parts[0].type === 'text') {
      formattedMessages.push({ role, content: parts[0].text });
    } else if (parts.length > 0) {
      formattedMessages.push({ role, content: parts });
    }
  }

  if (currentMessage) {
    const parts: any[] = [];
    if (currentMessage.text) {
      parts.push({ type: 'text', text: currentMessage.text });
    }
    if (currentMessage.image) {
      let imgUrl = currentMessage.image;
      if (!imgUrl.startsWith('data:') && !imgUrl.startsWith('http')) {
        imgUrl = `data:image/jpeg;base64,${imgUrl}`;
      }
      parts.push({
        type: 'image_url',
        image_url: { url: imgUrl }
      });
    }

    if (parts.length === 1 && parts[0].type === 'text') {
      formattedMessages.push({ role: 'user', content: parts[0].text });
    } else if (parts.length > 0) {
      formattedMessages.push({ role: 'user', content: parts });
    }
  }

  let lastError: any = null;

  for (const model of models) {
    try {
      console.log(`[Agnes AI] Memproses chat konsultasi dengan model: ${model}`);
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: formattedMessages,
          temperature: 0.7,
          max_tokens: 2000
        }),
        signal: AbortSignal.timeout(50000)
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`Agnes AI returned HTTP ${res.status}: ${errorText}`);
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content === 'string' && content.trim().length > 0) {
        return content.trim();
      }
      throw new Error("Agnes AI mengembalikan respon pesan kosong.");
    } catch (err: any) {
      console.warn(`[Agnes AI] Model ${model} chat failed:`, err?.message || err);
      lastError = err;
    }
  }

  throw lastError || new Error("Gagal berkonsultasi dengan Agnes AI.");
}
