import { HttpError } from './HttpError.js';

// Core's default (`maxBodyBytes`, `wire/BodyLimit.ts`) — this package declares NO Fougere
// dependency, a leaf port does not take one on the kernel for a number, so a host that reads
// the config hands its own value to `readExpressBody`.
export const MAX_BODY_BYTES = 2 * 1024 * 1024;

/** A Web body as text, refused on the length it declares, then while counting. */
export async function readWebBody(request: Request, max = MAX_BODY_BYTES): Promise<string> {
  if (Number(request.headers.get('content-length')) > max) throw HttpError.tooLarge(max);
  if (!request.body) return '';

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) throw HttpError.tooLarge(max);
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  const all = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    all.set(chunk, at);
    at += chunk.byteLength;
  }

  return new TextDecoder().decode(all);
}
