export interface ResponseResult {
  status: number;
  data: unknown;
  headers?: Record<string, string | string[]>;
  /** Send data as raw body (not JSON-serialized). Use for HTML, XML, CSV, plain text, etc. */
  raw?: boolean;
}

/** The Web `Response` a result is sent as — raw, empty on a 204, JSON otherwise. */
export function responseOf({ status, data, headers: written = {}, raw }: ResponseResult): Response {
  const headers = new Headers();
  for (const [name, value] of Object.entries(written)) {
    for (const one of Array.isArray(value) ? value : [value]) headers.append(name, one);
  }

  if (status === 204) return new Response(null, { status, headers });
  if (raw) return new Response(data as string, { status, headers });

  return Response.json(data, { status, headers });
}
