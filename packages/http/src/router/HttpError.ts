import type { ResponseResult } from './ResponseResult.js';

/**
 * What an adapter answers itself, before any handler: a body it will not read. The codes are core's
 * `ErrorCode` names, written here since this package takes no dependency on core.
 */
export class HttpError extends Error {
  static malformedJson(cause?: unknown): HttpError {
    return new HttpError(400, 'BAD_REQUEST', 'Malformed JSON body', { cause });
  }

  static tooLarge(max: number): HttpError {
    return new HttpError(413, 'PAYLOAD_TOO_LARGE', `The body is larger than ${max} bytes. Send less.`);
  }

  static unsupportedMediaType(contentType: string): HttpError {
    return new HttpError(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      `The body is sent as ${contentType || 'no declared type'}. Send it as application/json.`,
    );
  }

  private constructor(readonly status: number, readonly code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'HttpError';
  }

  result(): ResponseResult {
    return { status: this.status, data: { code: this.code, message: this.message } };
  }
}
