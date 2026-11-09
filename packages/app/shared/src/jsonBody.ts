import { ErrorCode, FougereError, maxBodyBytes, readWithin } from '@fougere/core';

/** The JSON body of a request, within `maxBodyBytes`; no body reads as `undefined`, another type is refused. */
export async function jsonBodyOf(request: Request): Promise<unknown> {
  const declared = request.headers.get('content-length');
  if (!request.body || declared === '0') return undefined;

  const raw = await readWithin(request.body, maxBodyBytes(), declared);
  if (!raw) return undefined;

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('json')) {
    throw new FougereError({
      code: ErrorCode.UNSUPPORTED_MEDIA_TYPE,
      message: `The body is sent as ${contentType || 'no declared type'}. Send it as application/json.`,
    });
  }

  try {
    return JSON.parse(raw);
  } catch (cause) {
    throw new FougereError({ code: ErrorCode.BAD_REQUEST, message: 'The body is not valid JSON.', cause });
  }
}
