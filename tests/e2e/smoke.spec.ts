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
