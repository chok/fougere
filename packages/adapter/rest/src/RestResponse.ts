import type { ResponseResult } from '@fougere/http';

/** An answer a link at REST's door may give in the op's place, declared in its return type. */
export interface RestResponse<Status extends number, Headers extends Record<string, string> = Record<never, string>, Body = null>
  extends ResponseResult {
  status: Status;
  headers: Headers;
  data: Body;
}
