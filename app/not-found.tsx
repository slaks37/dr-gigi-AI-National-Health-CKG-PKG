import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4 text-2xl font-bold">
        404
      </div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Halaman Tidak Ditemukan</h2>
      <p className="text-slate-600 mb-6 max-w-sm">
        Halaman yang Anda cari mungkin telah dipindahkan, dihapus, atau tautan tidak valid.
      </p>
      <Link 
        href="/"
        className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors shadow-sm"
      >
        Kembali ke Beranda
      </Link>
    </div>
  );
}
