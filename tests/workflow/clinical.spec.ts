import { test, expect, Page } from '@playwright/test';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9098';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8088';
const app = getApps().find(a => a.name === 'workflow') ?? initializeApp({ projectId: 'demo-sonri-workflow' }, 'workflow');
const auth = getAuth(app), db = getFirestore(app);
const password = 'synthetic-test-password-only';
async function login(page: Page, uid: string) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(`${uid}@example.test`);
  await page.getByLabel('Kata sandi').fill(password);
  await page.getByRole('button', { name: 'Masuk dengan email' }).click();
  await expect(page.getByRole('button', { name: 'Keluar akun' })).toBeVisible();
}
test.beforeAll(async () => {
  for (const [uid, claims] of [['synthetic-patient', { role: 'patient' }], ['synthetic-doctor', { role: 'doctor', clinicalReviewer: true }], ['synthetic-admin', { role: 'admin' }]] as const) {
    await auth.deleteUser(uid).catch(() => undefined);
    await auth.createUser({ uid, email: `${uid}@example.test`, password });
    await auth.setCustomUserClaims(uid, claims);
  }
  for (const name of ['records', 'patients', 'auditLogs', 'screeningQuotas', 'clinicalReviews', 'examinationRevisions', 'consentRecords']) {
    const docs = await db.collection(name).get(); await Promise.all(docs.docs.map(d => d.ref.delete()));
  }
});
test('patient → assignment → dentist odontogram → confirmation → report using real local auth and database', async ({ browser }) => {
  const patientContext = await browser.newContext(), doctorContext = await browser.newContext(), adminContext = await browser.newContext();
  const patient = await patientContext.newPage(), doctor = await doctorContext.newPage(), admin = await adminContext.newPage();
  await login(patient, 'synthetic-patient');
  await patient.goto('/checkup');
  await expect(patient.getByRole('button',{name:'Sign Out'})).toBeVisible();
  await patient.getByLabel('Usia pasien', { exact: true }).fill('30');
  await patient.getByRole('checkbox',{name:'Saya menyetujui pemrosesan gejala/foto',exact:false}).check();
  await patient.getByRole('button', { name: 'Simpan skrining terstruktur' }).click();
  await expect(patient.getByTestId('structured-result')).toBeVisible();
  const stored = await db.collection('records').where('userId', '==', 'synthetic-patient').get();
  expect(stored.size).toBe(1); const id = stored.docs[0].id;
  expect(stored.docs[0].data().screening.confirmed_icd10).toEqual([]);

  await login(admin, 'synthetic-admin'); await admin.goto('/clinical-review');
  await admin.getByRole('button').filter({ hasText: 'Dewasa —' }).click();
  await admin.getByLabel('UID dokter yang telah diverifikasi').fill('synthetic-doctor');
  await admin.getByRole('button', { name: 'Tugaskan dokter', exact: true }).click();
  await expect(admin.getByRole('status').filter({ hasText: 'Penugasan tersimpan' })).toBeVisible();

  await login(doctor, 'synthetic-doctor'); await doctor.goto('/clinical-review');
  await doctor.getByRole('button').filter({ hasText: 'Dewasa —' }).click();
  await doctor.screenshot({path:'test-results/synthetic-doctor-before-exam.png',fullPage:true});
  await doctor.getByLabel('Dentisi', { exact: true }).selectOption('PERMANENT');
  await doctor.getByText('Orientasi anatomis telah saya verifikasi').click();
  await doctor.getByLabel('Gigi 16', { exact: true }).selectOption('FINDING');
  await doctor.getByLabel('Temuan gigi 16', { exact: true }).fill('Synthetic cavitation fixture, not a patient');
  await doctor.getByText('Saya telah menjelaskan pemeriksaan', { exact: false }).click();
  await doctor.getByRole('button', { name: 'Simpan pemeriksaan', exact: true }).click();
  await expect(doctor.getByRole('status').filter({ hasText: 'riwayat perubahan tersimpan' })).toBeVisible();
  await doctor.getByLabel('Catatan / diagnosis hasil pemeriksaan').fill('Synthetic examination test only');
  await doctor.getByLabel('Bukti klinis (satu per baris;', { exact: false }).fill('Synthetic direct clinical examination');
  await doctor.getByLabel('Pemeriksaan klinis', { exact: true }).check();
  await doctor.getByLabel('Kode diagnosis ICD-10 WHO', { exact: false }).selectOption(['K02.9']);
  await doctor.getByRole('button', { name: 'Konfirmasi hasil pemeriksaan' }).click();
  await expect(doctor.getByRole('status').filter({ hasText: 'Tinjauan tersimpan' })).toBeVisible();
  await expect(doctor.getByText('Hasil: CLINICIAN_CONFIRMED', { exact: false })).toBeVisible();
  const confirmed = (await db.collection('records').doc(id).get()).data()!;
  expect(confirmed.screening.confirmed_icd10).toEqual(['K02.9']); expect(confirmed.examination.teeth[0].fdi).toBe('16');
  expect((await db.collection('clinicalReviews').get()).size).toBe(1);
  const download = doctor.waitForEvent('download');
  await doctor.getByRole('button', { name: 'Unduh laporan / cetak PDF' }).click();
  expect((await download).suggestedFilename()).toBe(`sonri-${id}.html`);
  await patientContext.close(); await doctorContext.close(); await adminContext.close();
});
