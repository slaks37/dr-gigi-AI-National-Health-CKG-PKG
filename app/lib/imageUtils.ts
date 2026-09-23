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
  // If already a base64 data URL
  if (typeof fileOrUrl === 'string' && fileOrUrl.startsWith('data:')) {
    const parts = fileOrUrl.split(',');
    const match = parts[0].match(/:(.*?);/);
    const mime = match ? match[1] : 'image/jpeg';
    return { data: parts[1] || '', mimeType: mime };
  }

  // Safe FileReader helper for iOS Safari
  const readViaFileReader = (file: File): Promise<{ data: string; mimeType: string }> => {
    return new Promise((resolve) => {
      try {
        const reader = new FileReader();
        reader.onload = () => {
          const res = (reader.result as string) || '';
          const commaIdx = res.indexOf(',');
          const base64 = commaIdx !== -1 ? res.substring(commaIdx + 1) : res;
          resolve({ data: base64, mimeType: file.type || 'image/jpeg' });
        };
        reader.onerror = () => resolve({ data: '', mimeType: 'image/jpeg' });
        reader.readAsDataURL(file);
      } catch {
        resolve({ data: '', mimeType: 'image/jpeg' });
      }
    });
  };

  // Modern browser approach (with strict iOS error guard)
  if (typeof window !== 'undefined' && 'createImageBitmap' in window && typeof fileOrUrl !== 'string') {
    try {
      const bitmap = await createImageBitmap(fileOrUrl);
      let width = bitmap.width;
      let height = bitmap.height;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, width, height);
        bitmap.close();
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const commaIdx = dataUrl.indexOf(',');
        const base64Data = commaIdx !== -1 ? dataUrl.substring(commaIdx + 1) : '';
        if (base64Data) {
          return {
            data: base64Data,
            mimeType: 'image/jpeg'
          };
        }
      }
    } catch (e) {
      console.warn('createImageBitmap compression skipped, falling back to Image element:', e);
    }
  }

  // Traditional HTML Image fallback
  return new Promise((resolve) => {
    const isFile = typeof fileOrUrl !== 'string';
    let objUrl = '';
    try {
      objUrl = isFile ? URL.createObjectURL(fileOrUrl) : fileOrUrl;
    } catch {
      objUrl = '';
    }

    if (!objUrl) {
      if (isFile && fileOrUrl) {
        readViaFileReader(fileOrUrl as File).then(resolve);
      } else {
        resolve({ data: '', mimeType: 'image/jpeg' });
      }
      return;
    }

    const img = new Image();
    // CRITICAL for Safari: NEVER set crossOrigin on blob: or data: URLs as it throws DOMException!
    if (!objUrl.startsWith('blob:') && !objUrl.startsWith('data:') && (objUrl.startsWith('http://') || objUrl.startsWith('https://'))) {
      img.crossOrigin = 'anonymous';
    }

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      if (isFile && objUrl && objUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(objUrl);
        } catch {}
      }
    };

    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width || 640;
        let height = img.naturalHeight || img.height || 480;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          if (isFile) readViaFileReader(fileOrUrl as File).then(resolve);
          else resolve({ data: '', mimeType: 'image/jpeg' });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        cleanup();

        const commaIdx = dataUrl.indexOf(',');
        const base64 = commaIdx !== -1 ? dataUrl.substring(commaIdx + 1) : '';
        resolve({
          data: base64,
          mimeType: 'image/jpeg'
        });
      } catch (err) {
        console.warn('Canvas toDataURL failed, using FileReader:', err);
        cleanup();
        if (isFile) readViaFileReader(fileOrUrl as File).then(resolve);
        else resolve({ data: '', mimeType: 'image/jpeg' });
      }
    };

    img.onerror = () => {
      cleanup();
      if (isFile) readViaFileReader(fileOrUrl as File).then(resolve);
      else resolve({ data: '', mimeType: 'image/jpeg' });
    };

    img.src = objUrl;
  });
}

export interface AnalyzePayload {
  systemInstruction?: string;
  prompt: string;
  images: Array<{ data: string; mimeType: string }>;
}

export async function safeCallGeminiAnalyze(payload: AnalyzePayload, signal?: AbortSignal): Promise<string> {
  const apiRes = await fetch('/api/gemini/analyze', {
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
    console.error('JSON parsing failed:', err, 'Raw body was:', textBody.slice(0, 100));
    throw new Error("Respon dari server tidak valid. Silakan coba lagi.");
  }

  if (!apiRes.ok || !resData?.success) {
    throw new Error(resData?.error || `Gagal melakukan analisis AI (Status ${apiRes.status}).`);
  }

  return resData.result;
}
