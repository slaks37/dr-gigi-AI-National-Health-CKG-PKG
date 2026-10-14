import { api } from '@/src/server/security';
import { resourceHandlers } from '@/src/server/resources';
const resources = resourceHandlers('records');
export const GET = api(resources.list);
export const POST = api(resources.save);
export const PATCH = api(resources.feedback);
export const DELETE = api(resources.remove);
