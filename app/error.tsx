'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-4 text-center">
      <h2 className="text-2xl font-bold mb-4">Terjadi Kesalahan</h2>
      <p className="mb-4 text-slate-600">Maaf, terjadi kesalahan pada sistem.</p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
      >
        Coba Lagi
      </button>
    </div>
  );
}
