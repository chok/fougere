import { entity, text } from '@fougere/schema';
import { describe, expect, it, vi } from 'vitest';
import { InFlight } from '../src/boot/inflight.js';
import type { OperationContract } from '../src/wire/operation.js';
import { ArgumentResolver } from '../src/dispatch/ArgumentResolver.js';
import { InputValidator } from '../src/dispatch/InputValidator.js';
import { OperationExecutor } from '../src/dispatch/OperationExecutor.js';
import { OutputProjector } from '../src/dispatch/OutputProjector.js';
import { OutputView } from '../src/dispatch/OutputView.js';

class Product extends entity({ name: text() }) {}

describe('OperationExecutor', () => {
  const contract: OperationContract = {
    input: Product,
    binding: [{ name: 'input', source: { kind: 'body' }, optional: false }],
  };

  it('runs the ordered operation boundary and releases its ticket', async () => {
    const order: string[] = [];
    const inFlight = new InFlight();
    const invoke = vi.fn(async ([input]: unknown[]) => {
      order.push('invoke');
      return { ...(input as object), internal: true };
    });
    const executor = new OperationExecutor({
      entity: 'product',
      frond: 'catalog',
      operation: 'create',
      contract,
      middlewares: () => [async (_context, next) => {
        order.push('middleware:before');
        const result = await next();
        order.push('middleware:after');
        return result;
      }],
      inFlight,
      validator: new InputValidator(),
      arguments: new ArgumentResolver(),
      invoke,
      projector: new OutputProjector(new OutputView(Product.getFields(), true)),
      present: async (result) => {
        order.push('present');
        return result;
      },
    });

    await expect(executor.execute({ body: { name: 'Fern' } }))
      .resolves.toEqual({ name: 'Fern' });
    expect(order).toEqual([
      'middleware:before',
      'invoke',
      'present',
      'middleware:after',
    ]);
    expect(invoke).toHaveBeenCalledWith([{ name: 'Fern' }]);
    expect(inFlight.count).toBe(0);
  });

  it('does not invoke the handler when validation refuses', async () => {
    const invoke = vi.fn();
    const inFlight = new InFlight();
    const executor = new OperationExecutor({
      entity: 'product',
      frond: 'catalog',
      operation: 'create',
      contract,
      middlewares: () => [],
      inFlight,
      validator: new InputValidator(),
      arguments: new ArgumentResolver(),
      invoke,
      projector: new OutputProjector(new OutputView(Product.getFields())),
    });

    await expect(executor.execute({ body: { unknown: true } }))
      .rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(invoke).not.toHaveBeenCalled();
    expect(inFlight.count).toBe(0);
  });
});
