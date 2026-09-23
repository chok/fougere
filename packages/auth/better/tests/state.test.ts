import { describe, it, expect } from 'vitest';
import { InputValidator } from '@fougere/schema';
import { betterAuth } from '../src/index.js';

describe('what a signed-in call carries', () => {
  const { state } = betterAuth({ secret: 'x'.repeat(32) });

  it('declares the user and the session, and the session without its token', () => {
    expect(Object.keys(state ?? {})).toEqual(['user', 'session']);
    expect(Object.keys(state!.session!.shape.properties ?? {})).not.toContain('token');
  });

  it('rebuilds the dates a session crossed a process with', () => {
    const judged = InputValidator.of(state!).validate({
      user: { id: 'u1', name: 'Ada', email: 'ada@example.com', emailVerified: true, createdAt: '2026-09-23T00:00:00.000Z', updatedAt: '2026-09-23T00:00:00.000Z' },
      session: { id: 's1', userId: 'u1', expiresAt: '2026-10-23T00:00:00.000Z', createdAt: '2026-09-23T00:00:00.000Z', updatedAt: '2026-09-23T00:00:00.000Z' },
    });

    expect(judged.success && (judged.data.session as { expiresAt: unknown }).expiresAt).toBeInstanceOf(Date);
  });
});
