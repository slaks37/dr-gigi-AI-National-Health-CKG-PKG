import type { Finding } from '../types/schema';

export const EXAMINATION_WORKFLOW_VERSION = 'oral-examination-research-2';
export const EXAMINATION_LABELS = {
  clinical_exam: 'Pemeriksaan langsung, lokasi dan riwayat oleh dokter gigi',
  radiography: 'Interpretasi radiografi yang sesuai oleh klinisi',
  vitality_test: 'Uji sensibilitas/vitalitas pulpa dan pemeriksaan periapikal',
  periodontal_exam: 'Pemeriksaan periodontal: probing, perdarahan, perlekatan dan mobilitas',
  histopathology: 'Hasil histopatologi yang diinterpretasi klinisi',
} as const;
export type ExaminationKey = keyof typeof EXAMINATION_LABELS;
export type ClinicalExaminations = Record<ExaminationKey, boolean>;
type Workflow = {
  examinations: ExaminationKey[]; observations: Finding['label'][];
  clinical_details: string[]; conditional_examinations: string[];
  differential_codes: string[]; limitations: string[]; references?: string[];
};
const endodonticReference = 'https://www.aae.org/specialty/wp-content/uploads/sites/2/2023/12/Fall2013-EndoDiagnosis.pdf';
const periodontalReference = 'https://www.efp.org/fileadmin/uploads/efp/Documents/Campaigns/New_Classification/Guidance_Notes/report-02b.pdf';
const mucosalReference = 'https://www.nhs.uk/conditions/mouth-ulcers/';
// These are authored workflow checklists, not WHO diagnostic criteria or clinically validated rules.
const workflows: Record<string, Workflow> = {
  K00: { examinations: ['clinical_exam'], observations: ['ENAMEL_OPACITY', 'TOOTH_DISCOLORATION', 'VISIBLE_MISSING_TOOTH_REGION'], clinical_details: ['Riwayat erupsi, perkembangan, keluarga dan dentisi primer/permanen/campuran', 'Pemeriksaan bentuk, jumlah, struktur dan lokasi gigi'], conditional_examinations: ['Radiografi bila diperlukan untuk membedakan gigi belum erupsi, tidak terbentuk, atau telah hilang'], differential_codes: ['K01.0', 'K01.1', 'K08.1'], limitations: ['Umur atau gigi yang tidak terlihat pada foto tidak membuktikan anodontia; penyebab perkembangan dan didapat harus dibedakan.'] },
  K01: { examinations: ['clinical_exam', 'radiography'], observations: ['VISIBLE_MISSING_TOOTH_REGION'], clinical_details: ['Status erupsi, lokasi dan penghalang mekanis dari pemeriksaan klinis serta radiografi'], conditional_examinations: ['Pencitraan tambahan hanya sesuai indikasi dan pertimbangan paparan oleh klinisi'], differential_codes: ['K00.0', 'K00.6', 'K08.1'], limitations: ['Foto intraoral saja tidak membedakan embedded dan impacted; wilayah kosong bukan bukti adanya impaksi.'] },
  K02: { examinations: ['clinical_exam'], observations: ['VISIBLE_CAVITATION', 'ENAMEL_OPACITY'], clinical_details: ['Permukaan gigi, aktivitas dan kedalaman lesi dinilai langsung; riwayat gejala'], conditional_examinations: ['Radiografi bila lokasi atau kedalaman tidak dapat dinilai langsung', 'Uji pulpa bila terdapat gejala atau dugaan keterlibatan pulpa'], differential_codes: ['K03.1', 'K03.2', 'K00.4'], limitations: ['Kavitas atau opasitas tidak menentukan kedalaman, aktivitas, cementum, maupun keterlibatan pulpa dari foto saja.'] },
  K03: { examinations: ['clinical_exam'], observations: ['VISIBLE_TOOTH_WEAR', 'POSSIBLE_CALCULUS', 'TOOTH_DISCOLORATION'], clinical_details: ['Pola keausan/deposit/perubahan warna, etiologi dan riwayat paparan atau trauma'], conditional_examinations: ['Radiografi untuk resorpsi, hipersementosis atau ankilosis bila diindikasikan', 'Uji pulpa dan pemeriksaan oklusi sesuai temuan'], differential_codes: ['K02.9', 'K00.4', 'K04.1'], limitations: ['Pola foto tidak menetapkan penyebab abrasi/erosi, kelainan akar atau viabilitas pulpa.'] },
  K04: { examinations: ['clinical_exam', 'radiography'], observations: ['VISIBLE_CAVITATION', 'VISIBLE_ORAL_SWELLING', 'TOOTH_DISCOLORATION'], clinical_details: ['Lokalisasi gigi, perjalanan nyeri, palpasi/perkusi dan korelasi pemeriksaan pulpa/periapikal'], conditional_examinations: ['Uji sensibilitas/vitalitas dengan pembanding dan periodontal sesuai keadaan klinis', 'Histopatologi bila diperlukan untuk membedakan kista/lesi periapikal'], differential_codes: ['K05.2', 'K09.9', 'K10.2'], limitations: ['Gejala nyeri tidak memastikan pulpitis atau nekrosis; radiolusensi periapikal tidak sendiri memastikan kista.'], references: [endodonticReference] },
  K05: { examinations: ['clinical_exam', 'periodontal_exam'], observations: ['VISIBLE_GINGIVAL_INFLAMMATION', 'VISIBLE_GINGIVAL_RECESSION', 'POSSIBLE_CALCULUS'], clinical_details: ['Probing, perdarahan, perlekatan klinis, mobilitas, distribusi dan perjalanan penyakit'], conditional_examinations: ['Radiografi untuk menilai tulang atau diagnosis banding sesuai indikasi'], differential_codes: ['K06.0', 'K06.1', 'K04.4'], limitations: ['Foto atau perdarahan yang dilaporkan tidak menentukan periodontitis, kehilangan perlekatan, atau klasifikasi akut/kronis.'], references: [periodontalReference] },
  K06: { examinations: ['clinical_exam', 'periodontal_exam'], observations: ['VISIBLE_GINGIVAL_RECESSION', 'VISIBLE_GINGIVAL_INFLAMMATION'], clinical_details: ['Distribusi, ukuran, mukogingiva, ridge dan riwayat trauma/obat'], conditional_examinations: ['Radiografi, evaluasi obat atau biopsi bila temuan dan riwayat mengindikasikan'], differential_codes: ['K05.1', 'K05.3', 'K13.6'], limitations: ['Gambaran gingiva tidak menetapkan kehilangan tulang atau penyebab pembesaran.'] },
  K07: { examinations: ['clinical_exam'], observations: [], clinical_details: ['Relasi oklusi, ukuran/relasi rahang, posisi gigi dan fungsi sendi temporomandibula'], conditional_examinations: ['Model studi, pencatatan fungsi, pencitraan atau rujukan ortodonti/bedah sesuai indikasi'], differential_codes: ['K00.2', 'K01.1', 'K10.9'], limitations: ['Satu foto, deteksi gigi, atau nomor FDI tidak menetapkan maloklusi, kelainan skeletal atau gangguan TMJ.'] },
  K08: { examinations: ['clinical_exam'], observations: ['VISIBLE_MISSING_TOOTH_REGION', 'VISIBLE_TOOTH_FRACTURE'], clinical_details: ['Riwayat tanggal/penyebab kehilangan atau pencabutan, inspeksi ridge dan struktur akar'], conditional_examinations: ['Radiografi untuk konfirmasi akar tersisa atau evaluasi ridge sesuai indikasi', 'Penilaian cedera akut atau penyebab sistemik di luar katalog K00–K14 bila diperlukan'], differential_codes: ['K00.0', 'K01.1', 'K04.8'], limitations: ['Daerah tanpa gigi tidak membuktikan penyebab kehilangan; trauma akut memerlukan penilaian kode cedera di luar K00–K14.'] },
  K09: { examinations: ['clinical_exam', 'radiography'], observations: ['VISIBLE_ORAL_SWELLING'], clinical_details: ['Lokasi lesi terhadap gigi/rahang, perkembangan dan interpretasi pencitraan'], conditional_examinations: ['Aspirasi atau histopatologi sesuai keputusan spesialis', 'Uji pulpa untuk diagnosis banding lesi odontogenik'], differential_codes: ['K04.8', 'K10.1', 'K11.6'], limitations: ['Foto dan radiolusensi saja tidak memastikan jenis kista; neoplasma dan kondisi di luar K00–K14 harus dipertimbangkan.'] },
  K10: { examinations: ['clinical_exam', 'radiography'], observations: ['VISIBLE_ORAL_SWELLING'], clinical_details: ['Riwayat ekstraksi, nyeri, paparan obat/radiasi, lokasi dan tanda infeksi'], conditional_examinations: ['Laboratorium, pencitraan atau histopatologi sesuai diagnosis banding oleh spesialis'], differential_codes: ['K04.7', 'K09.9', 'K12.2'], limitations: ['Pembengkakan tidak menentukan asal odontogenik atau penyakit rahang; gangguan napas/menelan memerlukan jalur darurat.'] },
  K11: { examinations: ['clinical_exam'], observations: ['VISIBLE_ORAL_SWELLING'], clinical_details: ['Palpasi kelenjar, duktus, aliran saliva, hubungan dengan makan dan riwayat obat'], conditional_examinations: ['Ultrasonografi/pencitraan, pemeriksaan saliva, laboratorium atau biopsi sesuai indikasi'], differential_codes: ['K09.9', 'K12.2', 'K13.7'], limitations: ['Foto tidak menetapkan sialolit, gangguan sekresi atau penyebab pembengkakan kelenjar; massa persisten perlu rujukan.'] },
  K12: { examinations: ['clinical_exam'], observations: ['VISIBLE_ORAL_ULCER', 'VISIBLE_ORAL_SWELLING'], clinical_details: ['Durasi, kekambuhan, luas/lokasi lesi, riwayat trauma/obat dan gejala sistemik'], conditional_examinations: ['Pemeriksaan infeksi, laboratorium atau biopsi/rujukan bila diindikasikan', 'Penilaian darurat untuk gangguan napas/menelan atau infeksi menyebar'], differential_codes: ['K13.7', 'K11.3', 'K04.7'], limitations: ['Ulkus atau pembengkakan tidak menentukan etiologi; lesi menetap lebih dari 3 minggu perlu pemeriksaan segera.'], references: [mucosalReference] },
  K13: { examinations: ['clinical_exam'], observations: ['WHITE_OR_RED_MUCOSAL_PATCH', 'VISIBLE_ORAL_ULCER', 'OTHER_UNCERTAIN_LESION'], clinical_details: ['Durasi, tekstur, lokasi, faktor iritasi/risiko dan pemeriksaan seluruh mukosa'], conditional_examinations: ['Rujukan spesialis dan biopsi/histopatologi untuk lesi mencurigakan sesuai keputusan klinisi', 'Pemeriksaan infeksi/sistemik bila sesuai diagnosis banding'], differential_codes: ['K12.1', 'K12.0', 'K14.0'], limitations: ['Tampilan putih/merah bukan diagnosis leukoplakia, dysplasia atau kanker; keganasan dan penyakit di luar K00–K14 belum disingkirkan.'], references: [mucosalReference] },
  K14: { examinations: ['clinical_exam'], observations: ['ABNORMAL_TONGUE_APPEARANCE', 'WHITE_OR_RED_MUCOSAL_PATCH'], clinical_details: ['Permukaan, papila, nyeri, perubahan lokasi lesi, obat, nutrisi dan faktor sistemik'], conditional_examinations: ['Laboratorium atau biopsi/rujukan bila temuan sistemik atau lesi mencurigakan', 'Evaluasi penyebab nyeri sebelum menetapkan glossodynia'], differential_codes: ['K13.2', 'K12.1', 'K13.7'], limitations: ['Warna atau bentuk lidah tidak memastikan infeksi, defisiensi atau penyebab glossodynia.'], references: [mucosalReference] },
};
const overrides: Record<string, Partial<Workflow>> = {
  'K00.0': { examinations: ['clinical_exam', 'radiography'] },
  'K03.3': { examinations: ['clinical_exam', 'radiography'] },
  'K03.4': { examinations: ['clinical_exam', 'radiography'] },
  'K03.5': { examinations: ['clinical_exam', 'radiography'] },
  'K03.6': { observations: ['POSSIBLE_CALCULUS'] },
  'K04.0': { examinations: ['clinical_exam', 'radiography', 'vitality_test'] },
  'K04.1': { examinations: ['clinical_exam', 'radiography', 'vitality_test'] },
  'K04.4': { examinations: ['clinical_exam', 'radiography', 'vitality_test'] },
  'K04.5': { examinations: ['clinical_exam', 'radiography', 'vitality_test'] },
  'K04.6': { examinations: ['clinical_exam', 'radiography', 'vitality_test'] },
  'K04.7': { examinations: ['clinical_exam', 'radiography', 'vitality_test'] },
  'K05.3': { examinations: ['clinical_exam', 'periodontal_exam', 'radiography'] },
  'K08.3': { examinations: ['clinical_exam', 'radiography'], observations: ['VISIBLE_TOOTH_FRACTURE'], differential_codes: ['K04.8', 'K01.1'] },
  'K10.3': { examinations: ['clinical_exam'], clinical_details: ['Riwayat pencabutan, waktu onset, pemeriksaan soket dan diagnosis banding infeksi'] },
  'K12.0': { clinical_details: ['Riwayat episode berulang dan pola lokasi/durasi ulkus; singkirkan trauma atau penyebab sistemik'], observations: ['VISIBLE_ORAL_ULCER'] },
};
export function workflowForCode(code: string): Workflow {
  return { ...workflows[code.slice(0, 3)], ...overrides[code] };
}
