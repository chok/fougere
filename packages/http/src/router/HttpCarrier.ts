/**
 * What an HTTP door carries a caller's state in for one request: the headers it arrived with, and
 * those it leaves with. The agreement between the doors and a keeper `over: 'http'` — a cookie.
 */
export interface HttpCarrier {
  request: Headers;
  response: Headers;
}
