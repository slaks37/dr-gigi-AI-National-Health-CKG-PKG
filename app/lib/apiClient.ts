import { auth } from './firebase';
export async function authenticatedFetch(input: string, init: RequestInit = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Harap masuk akun untuk melanjutkan.');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
  const response = await fetch(input, { ...init, headers, cache: 'no-store' });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Permintaan gagal (${response.status}).`);
  }
  if (auth.currentUser?.uid !== user.uid) throw new Error('Sesi telah berubah. Muat ulang data.');
  return response;
}
