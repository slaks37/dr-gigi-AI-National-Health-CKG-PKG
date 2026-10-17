// Opt-in isolated research deployment. Never enable this posture on production.
export function researchPreviewEnabled() {
  return process.env.SONRI_RESEARCH_PREVIEW === '1';
}
export function assertResearchPreviewEnvironment() {
  if (process.env.VERCEL_ENV !== 'preview') throw new Error('RESEARCH_PREVIEW_ENVIRONMENT_REQUIRED');
}
export function researchPreviewRequestAllowed(method: string, pathname: string) {
  return (method === 'GET' && pathname === '/api/vision-lab')
    || (method === 'POST' && pathname === '/api/vision-lab/browser')
    || (method === 'POST' && pathname === '/api/auth/sync');
}
