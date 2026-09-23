'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="id">
      <body className="font-sans antialiased bg-slate-50 text-slate-900">
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2 text-slate-900">Terjadi Kesalahan Sistem</h2>
          <p className="mb-6 text-slate-600 max-w-md">
            Maaf, terjadi kendala saat memuat halaman. Silakan muat ulang atau kembali ke beranda.
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => reset()}
              className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors shadow-sm"
            >
              Coba Lagi
            </button>
            <a
              href="/"
              className="px-6 py-2.5 bg-white text-slate-700 border border-slate-300 rounded-xl font-medium hover:bg-slate-50 transition-colors"
            >
              Kembali ke Beranda
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
