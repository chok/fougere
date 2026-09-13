/**
 * The two halves of what a call can refuse, and the line between them.
 *
 * What the FRAMEWORK refuses is implied by facts already on the card, so it does not travel —
 * writing it beside every op would be one fact in two places. What the FROND refuses does, since
 * nothing else implies that `publish` answers `CONFLICT`.
 */
import { describe, it, expect } from 'vitest';
import { ErrorCode, refusalsOf } from '../src/index.js';

describe('what the framework implies', () => {
  /** `InFlight.enter` refuses a call that arrives after the door closed. Any op can meet it. */
  it('names the drained door on every operation', () => {
    expect(refusalsOf({ kind: 'query' })).toContain(ErrorCode.SERVICE_UNAVAILABLE);
  });

  /** `validateInput` returns the invocation untouched when the op declares no view. */
  it('judges at the door only where a view is declared', () => {
    expect(refusalsOf({ kind: 'query', input: {} })).toContain(ErrorCode.VALIDATION_FAILED);
    expect(refusalsOf({ kind: 'query' })).not.toContain(ErrorCode.VALIDATION_FAILED);
  });

  /** `StorageGuard` judges what a handler WRITES, so a reading op never meets it. */
  it('guards a write and not a read', () => {
    expect(refusalsOf({ kind: 'command' })).toContain(ErrorCode.BAD_REQUEST);
    expect(refusalsOf({ kind: 'query' })).not.toContain(ErrorCode.BAD_REQUEST);
  });

  /** Only a call that leaves can fail to arrive. */
  it('names the wire only where the op crosses one', () => {
    expect(refusalsOf({ kind: 'query', remote: true })).toContain(ErrorCode.GATEWAY_TIMEOUT);
    expect(refusalsOf({ kind: 'query', remote: false })).not.toContain(ErrorCode.GATEWAY_TIMEOUT);
  });

  /**
   * `toPublicError` replaces its message before it leaves, so a caller never learns anything it
   * could act on. That makes it a bug rather than a refusal, and a contract must not name it.
   */
  it('never names the one whose message does not travel', () => {
    expect(refusalsOf({ kind: 'command', input: {}, remote: true })).not.toContain(ErrorCode.INTERNAL_ERROR);
  });
});

describe('what the frond declares', () => {
  it('puts the two halves together, sorted and without a repeat', () => {
    const all = refusalsOf({ kind: 'command', input: {}, errors: ['CONFLICT', 'SERVICE_UNAVAILABLE'] });

    expect(all).toEqual([...all].sort());
    expect(all.filter((code) => code === ErrorCode.SERVICE_UNAVAILABLE)).toHaveLength(1);
    expect(all).toContain(ErrorCode.CONFLICT);
  });

  /** An op that refuses nothing of its own still meets the door — the list is never empty. */
  it('answers with the framework half alone when the frond declares none', () => {
    expect(refusalsOf({ kind: 'query' })).toEqual([ErrorCode.SERVICE_UNAVAILABLE]);
  });
});
