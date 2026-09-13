import type { RequestContext } from './RequestContext.js';
import type { ResponseResult } from './ResponseResult.js';
import type { Next } from './Next.js';

export type Middleware = (ctx: RequestContext, next: Next) => Promise<ResponseResult>;
