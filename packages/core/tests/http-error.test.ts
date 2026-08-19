import { describe, it, expect, vi, afterEach } from 'vitest';
import { toHttpError, toPublicError, FougereError, ErrorCode } from '../src/index.js';

/**
 * The door is where a raw throw becomes an answer, and there are two halves to it:
 * framing what never was a `FougereError`, and masking the one code written for
 * nobody. These assertions used to live on `errorMiddleware`, which nothing installed
 * — so the behaviour that ships had none.
 */
afterEach(() => vi.restoreAllMocks());

describe('toHttpError', () => {
  it('frames a plain throw as a 500 INTERNAL_ERROR', () => {
    const { status, body } = toHttpError(new Error('plain'));
    expect(status).toBe(500);
    expect(body.code).toBe(ErrorCode.INTERNAL_ERROR);
  });

  it('never lets an internal message out — and logs it, so it exists once', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { body } = toHttpError(new Error('SELECT * FROM users WHERE token = abc'));
    expect(body.message).toBe('Internal error');
    expect(err).toHaveBeenCalledOnce();
    expect(String(err.mock.calls[0].join(' '))).toContain('SELECT');
  });

  it('carries a FougereError whole, with its own status', () => {
    const { status, body } = toHttpError(new FougereError({ code: ErrorCode.CONFLICT, message: 'already published' }));
    expect(status).toBe(409);
    expect(body.message).toBe('already published');
  });

  it('a foreign `code` property does not become an error code', () => {
    const { status, body } = toHttpError(Object.assign(new Error('bad'), { code: 'SOME_RANDOM_CODE' }));
    expect(status).toBe(500);
    expect(body.code).toBe(ErrorCode.INTERNAL_ERROR);
  });

  it('keeps where it happened, which is what makes it findable', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const body = toPublicError(
      new FougereError({ code: ErrorCode.INTERNAL_ERROR, message: 'boom', entity: 'product', operation: 'create' }),
    );
    expect(body).toMatchObject({ entity: 'product', operation: 'create', message: 'Internal error' });
  });
});
