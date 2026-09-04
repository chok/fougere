import type { InvocationContext } from '../wire/Invocation.js';
import type { BindingPlan } from '../wire/binding.js';

export interface CollectorResolver {
  collect(ctx: InvocationContext): Promise<unknown>;
}

export type CollectorLookup = (typeName: string) => CollectorResolver | undefined;

/** Resolves an operation's declared binding plan against one invocation. */
export class ArgumentResolver {
  constructor(private readonly collectors?: CollectorLookup) {}

  async resolve(plan: BindingPlan, ctx: InvocationContext): Promise<unknown[]> {
    const args: unknown[] = [];

    for (const binding of plan) {
      switch (binding.source.kind) {
        case 'collector': {
          const collector = this.collectors?.(binding.source.typeName);
          args.push(collector ? await collector.collect(ctx) : undefined);
          break;
        }
        case 'context': {
          args.push(ctx);
          break;
        }
        case 'param': {
          // `null` is a value, not a miss. Nullish coalescing used to make an explicit
          // nullable path/GraphQL argument fall through to query (or become undefined),
          // collapsing `T | null` into `T | undefined`. Only undefined means absent.
          const fromParams = ctx.params[binding.source.name];
          let val: unknown = fromParams === undefined
            ? ctx.query[binding.source.name]
            : fromParams;
          if (val != null && binding.source.coerce === 'number') val = Number(val);
          if (val != null && binding.source.coerce === 'boolean') val = val === 'true' || val === '1' || val === true;
          args.push(val);
          break;
        }
        case 'fact': {
          // A fact IS the payload — the whole of what happened, never a piece of it.
          // Identical to `body` today, and deliberately not sharing its branch: the two
          // agree by coincidence, not by rule, and the day `body` learns to look up a
          // value by parameter name a subscriber would receive ONE FIELD of the fact it
          // subscribed to. Splitting it costs nothing and removes that trap.
          args.push(ctx.body);
          break;
        }
        case 'body': {
          args.push(ctx.body);
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
}
