/**
 * A line says who wrote it and what it was written during — the class, and the operation the
 * process was running when it did.
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { createContainer } from '@fougere/container';
import { createApp, createLocalRunner, frond, Logger, type AppMiddleware } from '../src/index.js';
import { Invocation } from '../src/wire/Invocation.js';
import { ambient } from '../src/boot/ambient.als.js';
import { ambient as degraded } from '../src/boot/ambient.queue.js';
import { op } from './contract.js';

class Pricing {
  constructor(private log: Logger) {}

  recompute(): void {
    this.log.info('price recomputed');
  }
}

class AuthorHandler {
  constructor(private log: Logger) {}

  async findById(): Promise<{ id: string }> {
    this.log.info('author read');

    return { id: 'a1' };
  }
}

class PostHandler {
  constructor(private pricing: Pricing, private authors: AuthorHandler) {}

  async publish(): Promise<{ id: string }> {
    this.pricing.recompute();

    return this.authors.findById();
  }
}

const fronds = [
  frond('people', {
    handlers: [{ ctor: AuthorHandler, deps: ['Logger'], operations: { findById: op({ cardinality: 'one', description: 'One author.' }) } }],
  }),
  frond('blog', {
    providers: [{ ctor: Pricing, deps: ['Logger'] }],
    handlers: [{ ctor: PostHandler, deps: ['Pricing', 'authorHandler'], operations: { publish: op({ cardinality: 'one', description: 'Publish.' }) } }],
  }),
];

/** Every line the console printed, as the text a terminal shows. */
function printed(): string[] {
  const lines: string[] = [];
  vi.spyOn(console, 'info').mockImplementation((...text: unknown[]) => { lines.push(text.join(' ')); });

  return lines;
}

afterEach(() => { vi.restoreAllMocks(); });

describe('a line says who wrote it', () => {
  it('names the class that asked for the logger, under its frond', async () => {
    await using app = await createApp({ fronds, createContainer });
    const lines = printed();

    await createLocalRunner(app)({ entity: 'post', op: 'publish' }, Invocation.empty);

    expect(lines.find((line) => line.includes('price recomputed'))).toContain('[app:blog:Pricing]');
    expect(lines.find((line) => line.includes('author read'))).toContain('[app:people:AuthorHandler]');
  });
});

describe('a line says what it was written during', () => {
  it('carries the operation its handler runs, and a call inside another carries the caller', async () => {
    await using app = await createApp({ fronds, createContainer });
    const around: (string | undefined)[] = [];
    const watching: AppMiddleware = (ctx, next) => {
      if (ctx.entity === 'author') around.push(ambient.currentOperation());

      return next();
    };
    app.use(watching);
    const lines = printed();

    await createLocalRunner(app)({ entity: 'post', op: 'publish' }, Invocation.empty);

    expect(lines.find((line) => line.includes('price recomputed'))).toContain('(blog:PostHandler.publish)');
    expect(lines.find((line) => line.includes('author read'))).toContain('(people:AuthorHandler.findById)');
    expect(around).toEqual(['blog:PostHandler.publish']);
  });

  it('says nothing of it where the runtime has no async context', async () => {
    await degraded.enterOperation('blog:PostHandler.publish', async () => {
      expect(degraded.currentOperation()).toBeUndefined();
    });
  });
});
