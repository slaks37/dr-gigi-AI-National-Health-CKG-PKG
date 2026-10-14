# Ringkasan perbaikan dr Gigi AI

**Status: perbaikan pada branch terpisah untuk ditinjau; belum siap rilis produksi.**

Audit membuktikan celah pada identitas/peran API, kepemilikan rekam medis, promosi peran Firestore, status SATUSEHAT palsu, data IoT simulasi dan rujukan klinik fiktif. Perbaikan menutup jalur tersebut dengan verifikasi token server, custom claims, pembatasan kepemilikan/penugasan dokter, transaksi Firestore dan status integrasi yang jujur.

Analisis klinis foto/video, konsultasi AI, rPPG, overlay postur dan ingest IoT dinonaktifkan sampai validasi tersedia. SATUSEHAT tidak mengirim data; administrator hanya dapat membuat pratinjau FHIR lokal berstatus DRAFT. Tidak ada deployment produksi atau perubahan data pasien produksi.

Penyimpanan baru memakai Firestore sebagai sumber utama, melalui API server dengan audit dan konflik versi. SQL lama tetap dipertahankan tetapi tidak dibaca/ditulis oleh alur klinis baru. Data SQL-only, custom claims staf dan penugasan dokter wajib direkonsiliasi sebelum rilis. Cache medis lama tidak dibaca atau diimpor otomatis; penghapusan hanya melalui tindakan pengguna setelah cadangan aman tersedia.

## Verifikasi lokal

- TypeScript, lint dan build berhasil dengan validator aktif.
- 59 tes unit/API, 11 tes rules/transaksi Firestore dan 4 smoke test Chromium berhasil.
- Audit dependensi produksi: 0 kerentanan yang dilaporkan. Masih terdapat 11 advisory alat pengembangan (4 moderate, 7 high).
- Integrasi produksi, autentikasi Firebase nyata, restore SQL/backup, benchmark medis, perangkat fisik dan pengiriman SATUSEHAT belum diuji.

## Syarat sebelum rilis

Tinjau PR dan CI; verifikasi IAM Firebase Admin dan database; buat backup/restore test serta rekonsiliasi SQL–Firestore; tetapkan custom claims dari identitas staf yang disetujui; uji akun nyata dan otorisasi di staging. Fitur klinis/integrasi yang diblokir membutuhkan implementasi dan validasi tersendiri. Persetujuan eksplisit diperlukan sebelum deployment atau perubahan rules produksi.

Dokumen pendukung: AUDIT_BASELINE.md, SECURITY_FIXES.md, AI_CLINICAL_VALIDATION.md, SATUSEHAT_INTEGRATION_STATUS.md, QA_TEST_REPORT.md, DEPLOYMENT_CHECKLIST.md dan CHANGELOG.md.
