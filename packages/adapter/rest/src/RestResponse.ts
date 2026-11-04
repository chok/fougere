import type { ResponseResult } from '@fougere/http';

/**
 * An answer a link at REST's door may give in the op's place, declared in its return type — the status
 * and the headers are what the contract reads, in the vocabulary of OpenAPI's `responses`.
 */
export interface RestResponse<Status extends number, Headers extends Record<string, string> = Record<never, string>, Body = null>
  extends ResponseResult {
  status: Status;
  headers: Headers;
  data: Body;
}
