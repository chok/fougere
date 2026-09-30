import type { InvocationContext } from '../wire/InvocationContext.js';
import type { BindingPlan } from '../wire/binding.js';
import { ErrorCode } from '../wire/ErrorCode.js';
import { FougereError } from '../wire/FougereError.js';
import type { CollectorLookup } from './CollectorLookup.js';
import { collectedAs } from '../prefab/collector.js';

type ParamSource = Extract<BindingPlan[number]['source'], { kind: 'param' }>;

/** Resolves an operation's declared binding plan against one invocation. */
export class ArgumentResolver {
  constructor(private readonly collectors?: CollectorLookup) {}

  async resolve(plan: BindingPlan, ctx: InvocationContext): Promise<unknown[]> {
    const args: unknown[] = [];

    for (const binding of plan) {
      switch (binding.source.kind) {
        case 'collector': {
          const collector = this.collectors?.(binding.source.typeName);
          args.push(collector ? collectedAs(collector, await collector.collect(ctx)) : undefined);
          break;
        }
        case 'context': {
          args.push(ctx);
          break;
        }
        case 'param': {
          args.push(ArgumentResolver.param(binding.source, binding.optional, ctx));
          break;
        }
        case 'fact':
        case 'pipe': {
          // A fact IS the payload — the whole of what happened, never a piece of it. The
          // same holds before it is final: an op that finishes one is handed all of it,
          // and answers all of it.
          //
          // Identical to `input` today, and deliberately not sharing its branch: the two
          // agree by coincidence, not by rule, and the day `input` learns to look up a
          // value by parameter name a subscriber would receive ONE FIELD of the fact it
          // subscribed to. Splitting it costs nothing and removes that trap.
          args.push(ctx.input);
          break;
        }
        case 'input': {
          args.push(ctx.input);
          break;
        }
        case 'query': {
          args.push(ctx.query);
          break;
        }
      }
    }

    return args;
  }

  /**
   * A value the caller typed in a path or a query string. `null` is a value, not a miss: only
   * `undefined` means absent, so `T | null` stays apart from `T | undefined`.
   */
  private static param(source: ParamSource, optional: boolean, ctx: InvocationContext): unknown {
    const { name, coerce } = source;
    const fromParams = ctx.params[name];
    const value: unknown = fromParams === undefined ? ctx.query[name] : fromParams;

    if (value === undefined) {
      if (optional) return undefined;
      throw refused(name, 'Required');
    }
    if (value === null || coerce === undefined) return value;

    const coerced = coerce === 'number' ? ArgumentResolver.number(value) : ArgumentResolver.boolean(value);
    if (coerced === undefined) throw refused(name, `Expected a ${coerce}, got ${JSON.stringify(value)}`);

    return coerced;
  }

  private static number(value: unknown): number | undefined {
    if (typeof value === 'number') return Number.isNaN(value) ? undefined : value;
    if (typeof value !== 'string' || value.trim() === '') return undefined;
    const parsed = Number(value);

    return Number.isNaN(parsed) ? undefined : parsed;
  }

  private static boolean(value: unknown): boolean | undefined {
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;

    return undefined;
  }
}

function refused(name: string, message: string): FougereError {
  return new FougereError({
    code: ErrorCode.VALIDATION_FAILED,
    message: `${name}: ${message}`,
    details: [{ path: [name], message }],
  });
}
