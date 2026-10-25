import 'server-only';
import { GoogleAuth, IdentityPoolClient, Impersonated, IdTokenClient } from 'google-auth-library';
import { getVercelOidcToken } from '@vercel/oidc';

type Client = Pick<IdTokenClient, 'getRequestHeaders'>;
let cached: { key: string; client: Promise<Client> } | undefined;
const transport = { timeout: 7_000, retry: false };

// Platform IAM and the private worker credential authenticate different boundaries.
export async function inferenceHeaders(base: string, workerToken: string): Promise<Record<string, string>> {
  const headers: Record<string, string> = { Authorization: `Bearer ${workerToken}` };
  const mode = process.env.SONRI_INFERENCE_AUTH_MODE || 'NONE';
  if (mode === 'NONE') return headers;
  if (workerToken.length < 32) throw new Error('Private worker credential too short');
  if (!['GOOGLE_ADC', 'VERCEL_WIF'].includes(mode)) throw new Error('Unsupported inference identity mode');
  const url = new URL(base), audience = process.env.SONRI_INFERENCE_AUDIENCE;
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.run.app') || url.port || url.pathname !== '/' || url.search || url.hash || url.username || url.password || audience !== url.origin) throw new Error('Cloud Run requires its exact canonical service audience');
  const provider = process.env.SONRI_GCP_WIF_PROVIDER || '', account = process.env.SONRI_GCP_CALLER_SERVICE_ACCOUNT || '';
  if (mode === 'VERCEL_WIF' && (!/^projects\/\d+\/locations\/global\/workloadIdentityPools\/[a-z0-9-]+\/providers\/[a-z0-9-]+$/.test(provider) || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]@[a-z][a-z0-9-]{4,28}[a-z0-9]\.iam\.gserviceaccount\.com$/.test(account))) throw new Error('Incomplete workload federation identity');
  const key = JSON.stringify([mode, audience, provider, account]);
  if (cached?.key !== key) cached = { key, client: (async () => {
    if (mode === 'GOOGLE_ADC') return new GoogleAuth({ clientOptions: { transporterOptions: transport } }).getIdTokenClient(audience);
    const external = new IdentityPoolClient({
      audience: `//iam.googleapis.com/${provider}`, subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
      token_url: 'https://sts.googleapis.com/v1/token', transporterOptions: transport,
      subject_token_supplier: { getSubjectToken: () => getVercelOidcToken() },
    });
    const identity = new Impersonated({ sourceClient: external, targetPrincipal: account, targetScopes: [], transporterOptions: transport });
    return new IdTokenClient({ targetAudience: audience, idTokenProvider: identity, transporterOptions: transport });
  })() };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const client = cached;
    const authorization = await Promise.race([
      client.client.then(c => c.getRequestHeaders()).then(h => h.get('authorization')),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Identity deadline exceeded')), 8_000); }),
    ]);
    if (!authorization?.startsWith('Bearer ') || authorization.length > 16_384) throw new Error('Identity token unavailable');
    headers['X-Serverless-Authorization'] = authorization;
    return headers;
  } catch {
    cached = undefined;
    // Upstream authentication exceptions may contain credentials or response bodies.
    throw new Error('Inference service identity unavailable');
  } finally { if (timer) clearTimeout(timer); }
}
