import { afterEach, describe, it, expect, vi } from 'vitest';
import { compressImageToGenerativePart } from '../app/lib/imageUtils';
vi.mock('../app/lib/apiClient', () => ({ authenticatedFetch: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());
function imaging(corrupt = false) {
  const revoke = vi.fn();
  class FakeImage {
    naturalWidth = 1600; naturalHeight = 800;
    onload: null | (() => void) = null; onerror: null | (() => void) = null;
    set src(_value: string) { queueMicrotask(() => corrupt ? this.onerror?.() : this.onload?.()); }
  }
  vi.stubGlobal('Image', FakeImage);
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage: vi.fn() }), toDataURL: () => 'data:image/jpeg;base64,aW1hZ2U=' }) });
  const OriginalURL = URL;
  vi.stubGlobal('URL', class extends OriginalURL { static createObjectURL = () => 'blob:synthetic'; static revokeObjectURL = revoke; });
  return revoke;
}
describe('shared image processing', () => {
  it('rejects invalid MIME, oversized files and corrupt data URLs', async () => {
    await expect(compressImageToGenerativePart(new File(['text'], 'bad', { type: 'text/plain' }))).rejects.toThrow();
    await expect(compressImageToGenerativePart(new File([new Uint8Array(12_000_001)], 'big', { type: 'image/jpeg' }))).rejects.toThrow();
    await expect(compressImageToGenerativePart('data:image/jpeg;base64,%%%%')).rejects.toThrow();
    await expect(compressImageToGenerativePart('https://example.test/image.jpg')).rejects.toThrow();
  });
  it.each(['data:image/png;base64,aW1hZ2U=', 'blob:synthetic'])('decodes and compresses local input %s', async value => {
    imaging(); expect(await compressImageToGenerativePart(value)).toEqual({ data: 'aW1hZ2U=', mimeType: 'image/jpeg' });
  });
  it('releases File object URL on success and decode failure', async () => {
    const input = new File(['synthetic'], 'a.jpg', { type: 'image/jpeg' });
    const revoke = imaging(); await compressImageToGenerativePart(input); expect(revoke).toHaveBeenCalledWith('blob:synthetic');
    const errorRevoke = imaging(true); await expect(compressImageToGenerativePart(input)).rejects.toThrow('rusak'); expect(errorRevoke).toHaveBeenCalled();
  });
});
