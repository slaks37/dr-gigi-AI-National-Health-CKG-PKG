import 'server-only';
import type { Credential } from 'firebase-admin/app';
import { ExternalAccountClient } from 'google-auth-library';
import { getVercelOidcToken } from '@vercel/oidc';
import { assertResearchPreviewEnvironment } from './research-preview';

// The GCP trust must allow only this Vercel project's Preview environment.
// No private key, personal refresh token, or patient database permission is needed.
export function previewCredential(): Credential {
  assertResearchPreviewEnvironment();
  const audience = process.env.SONRI_GCP_WIF_AUDIENCE;
  const account = process.env.SONRI_GCP_AUTH_SERVICE_ACCOUNT;
  if (!audience || !/^\/\/iam\.googleapis\.com\/projects\/\d+\/locations\/global\/workloadIdentityPools\/[a-z0-9-]+\/providers\/[a-z0-9-]+$/.test(audience)
    || !account || !/^[a-z0-9-]+@project-96303d5e-7aac-460d-b72\.iam\.gserviceaccount\.com$/.test(account)) {
    throw new Error('RESEARCH_PREVIEW_AUTH_NOT_CONFIGURED');
  }
  const client = ExternalAccountClient.fromJSON({
    type: 'external_account', audience,
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    token_url: 'https://sts.googleapis.com/v1/token',
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${account}:generateAccessToken`,
    // Google passes its own STS audience to suppliers. Keep the original Vercel
    // team audience, which is the explicit allowed audience in the GCP provider.
    subject_token_supplier: { getSubjectToken: () => getVercelOidcToken() },
  });
  if (!client) throw new Error('RESEARCH_PREVIEW_AUTH_NOT_CONFIGURED');
  client.scopes = ['https://www.googleapis.com/auth/cloud-platform'];
  return { getAccessToken: async () => {
    assertResearchPreviewEnvironment();
    const { token } = await client.getAccessToken();
    if (!token || !client.credentials.expiry_date) throw new Error('RESEARCH_PREVIEW_AUTH_UNAVAILABLE');
    return { access_token: token, expires_in: Math.max(1, Math.floor((client.credentials.expiry_date - Date.now()) / 1000)) };
  } };
}
