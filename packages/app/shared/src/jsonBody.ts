import { ErrorCode, FougereError, maxBodyBytes, readWithin } from '@fougere/core';

/**
 * The JSON body of a request, read within `maxBodyBytes`. No body reads as `undefined`; a body of
 * another type is refused rather than read as `{}`, which left the op to refuse a missing field.
 */
export async function jsonBodyOf(request: Request): Promise<unknown> {
  const declared = request.headers.get('content-length');
  if (!request.body || declared === '0') return undefined;

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('json')) {
    throw new FougereError({
      code: ErrorCode.UNSUPPORTED_MEDIA_TYPE,
      message: `The body is sent as ${contentType || 'no declared type'}. Send it as application/json.`,
    });
  }

  const raw = await readWithin(request.body, maxBodyBytes(), declared);
  if (!raw) return undefined;

  try {
    return JSON.parse(raw);
  } catch (cause) {
    throw new FougereError({ code: ErrorCode.BAD_REQUEST, message: 'The body is not valid JSON.', cause });
  }
}
