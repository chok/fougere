import { describe, it, expect, vi } from 'vitest';
import { runMiddlewares, type AppMiddleware, type OperationContext } from '../src/wire/middleware.js';
import { FougereError, ErrorCode } from '../src/wire/errors.js';
import { loggerMiddleware } from '../src/wire/loggerMiddleware.js';
import { errorMiddleware } from '../src/wire/errorMiddleware.js';
import { Logger } from '../src/builtins/logger.js';

function ctx(overrides?: Partial<OperationContext>): OperationContext {
  return {
    entity: 'product',
    operation: 'create',
    args: [{ name: 'Fern' }],
    state: {},
    ...overrides,
  };
}

// ── runMiddlewares ──────────────────────────────

describe('runMiddlewares', () => {
  it('calls handler when no middlewares', async () => {
    const handler = vi.fn(async () => 'ok');
    const result = await runMiddlewares([], ctx(), handler);
    expect(result).toBe('ok');
    expect(handler).toHaveBeenCalledOnce();
  });

  it('executes middlewares in onion order', async () => {
    const order: string[] = [];

    const mw1: AppMiddleware = async (ctx, next) => {
      order.push('mw1:before');
      const result = await next();
      order.push('mw1:after');
      return result;
    };

    const mw2: AppMiddleware = async (ctx, next) => {
      order.push('mw2:before');
      const result = await next();
      order.push('mw2:after');
      return result;
    };

    await runMiddlewares([mw1, mw2], ctx(), async () => {
      order.push('handler');
      return 'done';
    });

    expect(order).toEqual(['mw1:before', 'mw2:before', 'handler', 'mw2:after', 'mw1:after']);
  });

  it('allows middleware to short-circuit', async () => {
    const handler = vi.fn(async () => 'ok');

    const blocker: AppMiddleware = async () => 'blocked';

    const result = await runMiddlewares([blocker], ctx(), handler);
    expect(result).toBe('blocked');
    expect(handler).not.toHaveBeenCalled();
  });

  it('propagates errors from handler through middlewares', async () => {
    const caught: unknown[] = [];

    const catcher: AppMiddleware = async (ctx, next) => {
      try {
        return await next();
      } catch (err) {
        caught.push(err);
        throw err;
      }
    };

    await expect(
      runMiddlewares([catcher], ctx(), async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(caught).toHaveLength(1);
  });

  it('passes context to all middlewares', async () => {
    const mw: AppMiddleware = async (ctx, next) => {
      ctx.state.touched = true;
      return next();
    };

    const c = ctx();
    await runMiddlewares([mw], c, async () => c.state);

    expect(c.state.touched).toBe(true);
  });
});

// ── FougereError ────────────────────────────────

describe('FougereError', () => {
  it('has code, entity, operation', () => {
    const err = new FougereError({
      code: ErrorCode.NOT_FOUND,
      message: 'Product not found',
      entity: 'product',
      operation: 'findById',
    });

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('FougereError');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.entity).toBe('product');
    expect(err.operation).toBe('findById');
    expect(err.message).toBe('Product not found');
  });

  it('serializes to JSON', () => {
    const err = new FougereError({
      code: ErrorCode.VALIDATION_FAILED,
      message: 'Invalid input',
      entity: 'order',
      operation: 'create',
    });

    expect(err.toJSON()).toEqual({
      code: ErrorCode.VALIDATION_FAILED,
      message: 'Invalid input',
      entity: 'order',
      operation: 'create',
    });
  });

  it('preserves cause', () => {
    const cause = new Error('original');
    const err = new FougereError({ code: ErrorCode.INTERNAL_ERROR, message: 'wrapped', cause });
    expect(err.cause).toBe(cause);
  });
});

// ── loggerMiddleware ────────────────────────────

describe('loggerMiddleware', () => {
  it('logs operation entry and exit', async () => {
    const logger = new Logger('test');
    const infoSpy = vi.spyOn(logger, 'info');

    const mw = loggerMiddleware(logger);
    await runMiddlewares([mw], ctx(), async () => 'ok');

    expect(infoSpy).toHaveBeenCalledTimes(2);
    expect(infoSpy.mock.calls[0][0]).toContain('product.create');
    expect(infoSpy.mock.calls[1][0]).toContain('product.create');
    expect(infoSpy.mock.calls[1][0]).toContain('ms');
  });

  it('logs errors', async () => {
    const logger = new Logger('test');
    const errorSpy = vi.spyOn(logger, 'error');

    const mw = loggerMiddleware(logger);
    await expect(
      runMiddlewares([mw], ctx(), async () => {
        throw new Error('fail');
      }),
    ).rejects.toThrow('fail');

    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy.mock.calls[0][0]).toContain('product.create');
  });
});

// ── errorMiddleware ─────────────────────────────

describe('errorMiddleware', () => {
  it('wraps plain errors into FougereError', async () => {
    const mw = errorMiddleware();

    try {
      await runMiddlewares([mw], ctx(), async () => {
        throw new Error('plain');
      });
    } catch (err) {
      expect(err).toBeInstanceOf(FougereError);
      expect((err as FougereError).code).toBe('INTERNAL_ERROR');
      expect((err as FougereError).entity).toBe('product');
      expect((err as FougereError).operation).toBe('create');
      expect((err as FougereError).cause).toBeInstanceOf(Error);
      return;
    }
    expect.fail('should have thrown');
  });

  it('passes through FougereError unchanged', async () => {
    const mw = errorMiddleware();
    const original = new FougereError({ code: ErrorCode.CONFLICT, message: 'custom' });

    try {
      await runMiddlewares([mw], ctx(), async () => {
        throw original;
      });
    } catch (err) {
      expect(err).toBe(original);
      return;
    }
    expect.fail('should have thrown');
  });

  it('wraps unknown errors as INTERNAL_ERROR', async () => {
    const mw = errorMiddleware();
    const custom = Object.assign(new Error('bad'), { code: 'SOME_RANDOM_CODE' });

    try {
      await runMiddlewares([mw], ctx(), async () => {
        throw custom;
      });
    } catch (err) {
      expect((err as FougereError).code).toBe('INTERNAL_ERROR');
      return;
    }
    expect.fail('should have thrown');
  });
});
