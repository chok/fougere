/**
 * The order an operation crosses its boundary in, and what a refusal stops.
 *
 * Both used to be stated against `OperationExecutor`, a class the façade built and
 * nobody else reached. The steps are the façade's own now, so the test states them
 * where a caller meets them: through a booted app.
 */
import { join } from 'node:path';
import { describe, it, expect, beforeEach } from 'vitest';
import { createContainer } from '@fougere/container';
import { createApp, createLocalRunner } from '../src/index.js';
import { scanProject } from '../src/node.js';
import { EMPTY_INVOCATION } from '../src/wire/Invocation.js';
import type { AppMiddleware } from '../src/wire/middleware.js';
import { trace } from './fixtures-operation-boundary/trace.js';

const scan = await scanProject(join(import.meta.dirname, 'fixtures-operation-boundary'));
const app = () => createApp({ scan, createContainer });

const recording: AppMiddleware = async (_context, next) => {
  trace.push('middleware:before');
  const result = await next();
  trace.push('middleware:after');

  return result;
};

beforeEach(() => { trace.length = 0; });

describe('an operation crosses its boundary in one order', () => {
  it('runs the handler and the presenter inside the middleware', async () => {
    await using mounted = await app();
    mounted.use(recording);
    const run = createLocalRunner(mounted);

    const created = await run(
      { entity: 'product', op: 'create' },
      { ...EMPTY_INVOCATION, input: { id: 'p1', name: 'Fern' } },
    );

    // `internal` survives: the op declares no closed view, and an open one adds without cutting.
    expect(created).toEqual({ id: 'p1', name: 'Fern', internal: true, shouted: 'FERN' });
    expect(trace).toEqual([
      'middleware:before',
      'handler',
      'present',
      'middleware:after',
    ]);
  });

  it('does not reach the handler when the input is refused', async () => {
    await using mounted = await app();
    mounted.use(recording);
    const run = createLocalRunner(mounted);

    await expect(run(
      { entity: 'product', op: 'create' },
      { ...EMPTY_INVOCATION, input: { id: 'p1', name: 'Fern', unknown: true } },
    )).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });

    // No `middleware:after`: the refusal travels back out through `next()`.
    expect(trace).toEqual(['middleware:before']);
  });
});
