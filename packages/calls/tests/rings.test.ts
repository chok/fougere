import { describe, expect, it } from 'vitest';
import { Call, DispatchEvent, RouteAddress, ErrorCode, FougereError } from '@fougere/core';
import { ErrorRing, LogRing, QueryRing } from '../src/rings.js';

const line = (level: 'debug' | 'info' | 'warn' | 'error', message: string, args: unknown[] = []) =>
  ({ level, name: 'boot:app', message, args, at: Date.now() });

describe('the log ring', () => {
  it('renders arguments rather than holding them', () => {
    const ring = new LogRing();
    const live = { state: 'before' };
    ring.record(line('info', 'a thing happened', [live]));
    live.state = 'after';

    // A held object would let the panel show what it later became, not what was written.
    expect(ring.since(0).lines[0]!.args).toEqual(['{"state":"before"}']);
  });
});

describe('the query ring', () => {
  it('keeps the count of parameters and never a value', () => {
    const ring = new QueryRing();
    ring.record({ storage: 'db', sql: 'select * from post where id = ?', parameters: 1, ms: 2, failed: false, at: 1 });

    expect(JSON.stringify(ring.since(0))).not.toContain('secret');
    expect(ring.since(0).lines[0]).toMatchObject({ parameters: 1, ms: 2 });
  });
});

describe('the error ring', () => {
  const failed = (entity: string, op: string, error: unknown) =>
    DispatchEvent.failed(new Call(new RouteAddress({ entity, operation: op })), error);

  it('unfolds a validation refusal field by field', () => {
    const ring = new ErrorRing();
    ring.fromDispatch(failed('post', 'create', new FougereError({
      code: ErrorCode.VALIDATION_FAILED,
      message: 'title: is required',
      details: [{ path: 'title', message: 'is required' }],
    })));

    // What a span cannot carry: it keeps the code and drops the reason.
    expect(ring.since(0).lines[0]).toMatchObject({
      code: 'VALIDATION_FAILED',
      entity: 'post',
      operation: 'create',
      fields: [{ path: 'title', message: 'is required' }],
      from: 'dispatch',
    });
  });

  it('groups one kind of refusal and re-numbers it, so a reader sees the count grow', () => {
    const ring = new ErrorRing();
    const boom = () => failed('post', 'create', new FougereError({ code: ErrorCode.NOT_FOUND, message: 'gone' }));
    ring.fromDispatch(boom());
    const first = ring.since(0);
    expect(first.lines).toHaveLength(1);

    ring.fromDispatch(boom());
    ring.fromDispatch(boom());

    // Above the reader's cursor again, carrying three — not three separate lines.
    const next = ring.since(first.cursor);
    expect(next.lines).toHaveLength(1);
    expect(next.lines[0]!.count).toBe(3);
  });

  it('takes what failed outside any call, which no dispatch can report', () => {
    const ring = new ErrorRing();
    ring.fromLog(line('error', 'storage could not be opened'));
    ring.fromLog(line('warn', 'something milder'));

    const held = ring.since(0).lines;
    expect(held).toHaveLength(1);
    expect(held[0]).toMatchObject({ from: 'log', message: 'storage could not be opened' });
  });
});
