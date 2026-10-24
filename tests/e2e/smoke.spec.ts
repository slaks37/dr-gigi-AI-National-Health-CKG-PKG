import { test, expect } from '@playwright/test';
test('settings reports real integration readiness without fake credentials', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByText('SATUSEHAT: NOT_CONFIGURED.', { exact: false })).toBeVisible();
  await expect(page.getByText('IoT: DISCONNECTED.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Simpan preferensi akun' })).toBeDisabled();
  await expect(page.getByText('drgigi_live_sec_88491028471928')).toHaveCount(0);
});
test('anonymous medical APIs cannot be read or written', async ({ request }) => {
  for (const url of ['/api/records?role=admin', '/api/activity', '/api/stats', '/api/iot/ingest', '/api/models', '/api/clinical-catalog', '/api/clinical-coverage', '/api/encounter-exam?id=synthetic', '/api/clinical-report?id=synthetic']) {
    const response = await request.get(url); expect(response.status()).toBe(401);
  }
  for (const url of ['/api/records', '/api/satusehat/sync', '/api/gemini/analyze', '/api/encounter-exam', '/api/model-lab', '/api/clinical-fhir']) {
    const response = await request.post(url, { data: { role: 'admin', userUid: 'synthetic' } }); expect(response.status()).toBe(401);
  }
});
test('per-code evidence matrix distinguishes terminology from independent model validation on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/evidence-coverage');
  await expect(page.getByRole('heading', { name: 'Cakupan bukti K00–K14' })).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(108);
  await expect(page.locator('tbody tr').filter({ hasText: 'K02.9' })).toContainText('Belum terbukti independen');
  await expect(page.getByText('Penggunaan klinis model: PROHIBITED.', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test('SONRI workspace is usable at mobile width and retains research gates', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/sonri');
  await expect(page.getByRole('heading', { name: 'Bukti klinis, keputusan dokter.' })).toBeVisible();
  await expect(page.getByRole('link', { name: '03 Ruang dokter', exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto('/model-lab');
  await expect(page.getByText('Masuk sebagai administrator', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Jalankan inferensi penelitian' })).toHaveCount(0);
});
test('clinics show no fabricated results without coordinates', async ({ page }) => {
  await page.goto('/clinics');
  await expect(page.getByText('Klinik Pratama Sehat Bersama (Dental Care)')).toHaveCount(0);
  await expect(page.getByText('Izinkan lokasi atau berikan koordinat', { exact: false })).toBeVisible();
});
test('clinical photo paths visibly report review gate', async ({ page }) => {
  for (const path of ['/checkup', '/checkup-anak', '/antropometri']) {
    await page.goto(path); await expect(page.getByRole('status').filter({ hasText: 'REQUIRES_REVIEW' })).toBeVisible();
  }
});

test('adult emergency triage works before uploads or authentication',async({page})=>{
 await page.goto('/checkup');
 await page.getByLabel('Sulit bernapas',{exact:true}).selectOption('YES');
 await expect(page.getByTestId('triage-alert')).toContainText('Segera ke IGD');
 await expect(page.getByLabel('Foto skrining oral',{exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Simpan skrining terstruktur'})).toBeDisabled();
});
test('pediatric questionnaire preserves unknown answers and never invents healthy result',async({page})=>{
 await page.goto('/checkup-anak');
 await expect(page.getByLabel('Nyeri gigi/mulut',{exact:true})).toHaveValue('UNKNOWN');
 await expect(page.getByTestId('triage-alert')).toContainText('Lengkapi pertanyaan tanda bahaya');
 await expect(page.getByTestId('structured-result')).toHaveCount(0);
});
test('review and annotation pages expose readiness truthfully without private source photos',async({page})=>{
 await page.goto('/clinical-review');await expect(page.getByRole('heading',{name:'Tinjauan dokter gigi',exact:true})).toBeVisible();await expect(page.getByText('Masuk akun dokter/administrator',{exact:false})).toBeVisible();
 await page.goto('/dataset-review');await expect(page.getByText('kelengkapan total belum disertifikasi',{exact:false})).toBeVisible();await expect(page.getByRole('img')).toHaveCount(0);
});
