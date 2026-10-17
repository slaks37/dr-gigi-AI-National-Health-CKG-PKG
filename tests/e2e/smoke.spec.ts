import { test, expect } from '@playwright/test';
test('settings reports real integration readiness without fake credentials', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByText('SATUSEHAT: NOT_CONFIGURED.', { exact: false })).toBeVisible();
  await expect(page.getByText('IoT: DISCONNECTED.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Simpan preferensi akun' })).toBeDisabled();
  await expect(page.getByText('drgigi_live_sec_88491028471928')).toHaveCount(0);
});
test('anonymous medical APIs cannot be read or written', async ({ request }) => {
  for (const url of ['/api/records?role=admin', '/api/activity', '/api/stats', '/api/iot/ingest']) {
    const response = await request.get(url); expect(response.status()).toBe(401);
  }
  for (const url of ['/api/records', '/api/satusehat/sync', '/api/gemini/analyze']) {
    const response = await request.post(url, { data: { role: 'admin', userUid: 'synthetic' } }); expect(response.status()).toBe(401);
  }
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

test('five modules and Model Lab access limits are visible',async({page,request})=>{await page.goto('/checkup');await expect(page.getByRole('region',{name:'Lima modul SONRI'})).toBeVisible();await expect(page.getByRole('heading',{name:'Bukti klinis dan radiografi',exact:true})).toBeVisible();await page.goto('/admin/vision-lab');await expect(page.getByText('Akses administrator diperlukan.',{exact:true})).toBeVisible();expect((await request.get('/api/vision-lab')).status()).toBe(401);});

test('browser research requires admin and loads no runtime for anonymous visitors', async ({ page, request }) => {
 const runtimeRequests: string[] = []; page.on('request', r => { if (/\/(?:ort|browser-ai)\//.test(r.url())) runtimeRequests.push(r.url()); });
 await page.goto('/admin/vision-lab'); await expect(page.getByText('Akses administrator diperlukan.', { exact: true })).toBeVisible();
 expect((await request.post('/api/vision-lab/browser', { data: { research_authorized: true, synthetic_only: true } })).status()).toBe(401);
 expect((await request.get('/models/sonri-rfdetr-large-v1.onnx')).status()).toBe(404);
 expect(runtimeRequests).toEqual([]); await expect(page.getByRole('region', { name: 'Browser AI' })).toHaveCount(0);
});
