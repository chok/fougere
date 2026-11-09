import { ErrorCode } from './ErrorCode.js';
import { FougereError } from './FougereError.js';

let limit = 2 * 1024 * 1024;

/** The room a hop keeps for what it adds around a call — trace, identity, state — which never counts against the caller. */
export const ENVELOPE_BYTES = 64 * 1024;

export function maxBodyBytes(): number {
  return limit;
}

/** Set by `applyConfig` from `maxBodyBytes:`. */
export function setMaxBodyBytes(bytes: number): void {
  if (!Number.isInteger(bytes) || bytes <= 0) {
    throw new Error(`maxBodyBytes must be a positive whole number of bytes, got ${String(bytes)}.`);
  }
  limit = bytes;
}

/**
 * What a forwarding process may frame: the caller's limit, plus the envelope's room.
 *
 * Documented: [gradient](https://fougere.dev/docs/concepts/configuration).
 */
export function maxFrameBytes(): number {
  return limit + ENVELOPE_BYTES;
}

/** A body as text, refused past `max`: on its declared length first, then while counting. */
export async function readWithin(
  body: ReadableStream<Uint8Array> | AsyncIterable<Uint8Array> | null | undefined,
  max: number,
  declared?: string | null,
): Promise<string> {
  if (Number(declared) > max) throw tooLarge(max);
  if (!body) return '';

  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of 'getReader' in body ? chunksOf(body) : body) {
    size += chunk.byteLength;
    if (size > max) throw tooLarge(max);
    chunks.push(chunk);
  }

  const all = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    all.set(chunk, at);
    at += chunk.byteLength;
  }

  return new TextDecoder().decode(all);
}

/** A Web stream is read through its reader, which every runtime has, and cancelled when left early. */
async function* chunksOf(body: ReadableStream<Uint8Array>): AsyncIterable<Uint8Array> {
  const reader = body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}

function tooLarge(max: number): FougereError {
  return new FougereError({
    code: ErrorCode.PAYLOAD_TOO_LARGE,
    message: `The body is larger than ${max} bytes. Send less, or raise maxBodyBytes in fougere.config.ts.`,
  });
}
