import type { HttpMethod } from './HttpMethod.js';

export interface RequestContext {
  /** The request as a Web Standard `Request`. */
  readonly request: Request;
  method: HttpMethod;
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
  body: () => Promise<unknown>;
  /** Extensible bag — middlewares deposit data here (auth, session, etc.). */
  state: Record<string, unknown>;
}
