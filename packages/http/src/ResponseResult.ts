export interface ResponseResult {
  status: number;
  data: unknown;
  headers?: Record<string, string | string[]>;
  /** Send data as raw body (not JSON-serialized). Use for HTML, XML, CSV, plain text, etc. */
  raw?: boolean;
}
