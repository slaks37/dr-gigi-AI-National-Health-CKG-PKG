import { z } from 'zod';
import { ApiError } from '../../server/security';
export function parse<T>(schema:z.ZodType<T>,value:unknown):T {
 const result=schema.safeParse(value);
 if(!result.success)throw new ApiError(400,'Invalid structured clinical input');
 return result.data;
}
