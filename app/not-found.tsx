import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-4 text-center">
      <h2 className="text-2xl font-bold mb-4">Halaman Tidak Ditemukan</h2>
      <p className="mb-4 text-slate-600">Maaf, halaman yang Anda cari tidak ada.</p>
      <Link
        href="/"
        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
      >
        Kembali ke Beranda
      </Link>
    </div>
  );
}
