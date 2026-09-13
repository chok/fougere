import type { RequestContext } from './RequestContext.js';
import type { ResponseResult } from './ResponseResult.js';

export type Handler = (ctx: RequestContext) => Promise<ResponseResult>;
