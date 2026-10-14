import { api, ApiError } from '@/src/server/security';
// Device enrollment, revocation, durable telemetry and GATT reception have not been validated.
// A user token does not authorize a physical device; reject all telemetry until enrollment exists.
const unavailable = api(async () => { throw new ApiError(503, 'IoT NOT_CONFIGURED: verified device enrollment and durable telemetry are required'); });
export const POST = unavailable;
export const GET = unavailable;
