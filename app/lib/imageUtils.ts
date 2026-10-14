import { authenticatedFetch } from './apiClient';
/**
 * Image processing & safe AI analysis caller
 * Designed to prevent iOS Safari "The string did not match the expected pattern" errors
 * and prevent oversized request payloads (HTTP 413 / 502).
 */

export async function compressImageToGenerativePart(
  fileOrUrl: File | string,
  maxDimension = 800,
  quality = 0.75
): Promise<{ data: string; mimeType: string }> {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!Number.isFinite(maxDimension) || maxDimension < 1 || maxDimension > 4096 || !Number.isFinite(quality) || quality <= 0 || quality > 1) throw new Error('Parameter kompresi tidak valid.');
  if (typeof fileOrUrl !== 'string' && (!allowed.includes(fileOrUrl.type) || fileOrUrl.size > 12_000_000 || fileOrUrl.size === 0)) throw new Error('Gunakan JPEG, PNG, atau WebP hingga 12 MB.');
  if (typeof fileOrUrl === 'string') {
    if (fileOrUrl.startsWith('data:')) {
      const match = fileOrUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
      if (!match || match[2].length > 16_000_000) throw new Error('Data gambar tidak valid atau terlalu besar.');
    } else if (!fileOrUrl.startsWith('blob:')) throw new Error('Gunakan berkas atau URL gambar lokal.');
  }
  // Every input, including data URLs, is decoded before it can bypass compression.
  return new Promise((resolve, reject) => {
    const ownedUrl = typeof fileOrUrl !== 'string';
    const url = ownedUrl ? URL.createObjectURL(fileOrUrl) : fileOrUrl;
    const img = new Image();
    const cleanup = () => { clearTimeout(timer); if (ownedUrl) URL.revokeObjectURL(url); img.onload = null; img.onerror = null; };
    const timer = setTimeout(() => { cleanup(); reject(new Error('Gambar tidak dapat dibaca dalam batas waktu.')); }, 10_000);
    img.onerror = () => { cleanup(); reject(new Error('Berkas gambar rusak atau tidak didukung.')); };
    img.onload = () => {
      try {
        const w = img.naturalWidth, h = img.naturalHeight;
        if (!w || !h || w * h > 40_000_000) throw new Error('Dimensi gambar tidak didukung.');
        const scale = Math.min(1, maxDimension / Math.max(w, h));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Pemrosesan gambar tidak tersedia.');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const data = canvas.toDataURL('image/jpeg', quality).split(',')[1];
        if (!data) throw new Error('Kompresi gambar gagal.');
        cleanup(); resolve({ data, mimeType: 'image/jpeg' });
      } catch (error) { cleanup(); reject(error); }
    };
    img.src = url;
  });
}

export interface AnalyzePayload {
  systemInstruction?: string;
  prompt: string;
  images: Array<{ data: string; mimeType: string }>;
}

export async function safeCallGeminiAnalyze(payload: AnalyzePayload, signal?: AbortSignal): Promise<string> {
  const apiRes = await authenticatedFetch('/api/gemini/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify(payload)
  });

  const contentType = apiRes.headers.get('content-type') || '';
  // Always use text() instead of json() to avoid WebKit DOMException in Safari
  const textBody = await apiRes.text().catch(() => '');

  if (!contentType.includes('application/json')) {
    if (apiRes.status === 413 || textBody.includes('413') || textBody.toLowerCase().includes('payload too large') || textBody.toLowerCase().includes('entity too large')) {
      throw new Error("Ukuran foto terlalu besar untuk diproses server. Mohon gunakan 1 foto atau ambil ulang foto dengan resolusi standar.");
    }
    if (apiRes.status === 502 || apiRes.status === 503 || apiRes.status === 504 || textBody.toLowerCase().includes('warmup') || textBody.toLowerCase().includes('starting')) {
      throw new Error("Server AI sedang proses inisialisasi / sibuk. Mohon tunggu 5-10 detik lalu tekan tombol Analisis kembali.");
    }
    throw new Error(`Server AI mengembalikan respon status ${apiRes.status}. Silakan coba beberapa saat lagi.`);
  }

  let resData: any = null;
  try {
    resData = textBody ? JSON.parse(textBody) : null;
  } catch (err) {
    console.error('AI response format invalid');
    throw new Error("Respon dari server tidak valid. Silakan coba lagi.");
  }

  if (!apiRes.ok || !resData?.success) {
    throw new Error(resData?.error || `Gagal melakukan analisis AI (Status ${apiRes.status}).`);
  }

  return resData.result;
}
