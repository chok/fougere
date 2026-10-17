import { FieldValueValidator, InputRefusal, type SchemaView } from '@fougere/schema';
import type { InvocationContext } from '../wire/InvocationContext.js';
import type { BindingPlan } from '../wire/binding.js';
import { ErrorCode } from '../wire/ErrorCode.js';
import { FougereError } from '../wire/FougereError.js';
import type { Container } from '@fougere/container';
import type { EntityLookup } from './EntityLookup.js';
import { BindingSources } from '../BindingSources.js';
import { validateInput } from './validateInput.js';

type ParamSource = Extract<BindingPlan[number]['source'], { kind: 'param' }>;

/** Resolves an operation's declared binding plan against one invocation. */
export class ArgumentResolver {
  constructor(
    private readonly scope?: Container,
    private readonly entities?: EntityLookup,
  ) {}

  async resolve(plan: BindingPlan, ctx: InvocationContext): Promise<unknown[]> {
    const args: unknown[] = [];
    const body = ArgumentResolver.bodyOf(plan, ctx);

    for (const binding of plan) {
      switch (binding.source.kind) {
        case 'context': {
          args.push(ctx);
          break;
        }
        case 'param': {
          args.push(this.judged(binding.source, ArgumentResolver.param(binding.source, binding.optional, ctx, body)));
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
        default:
          args.push(await BindingSources.resolve(binding.source.kind).resolve(binding.source, { ctx, scope: this.scope }));
      }
    }

    return args;
  }

  /**
   * The arguments code wrote, judged where a door would have judged them: the input against
   * the op's view, a value a binding source fills judged by that source —
   * which also puts back a `Date` that crossed a wire as text. Nothing is collected: what the
   * caller left out stays out.
   */
  given(plan: BindingPlan, input: SchemaView | undefined, ctx: InvocationContext): unknown[] {
    const args = ctx.args ?? [];

    return plan.map((binding, index) => {
      const value = args[index];
      switch (binding.source.kind) {
        case 'context':
          return ctx;
        case 'input':
          return validateInput(input, { ...ctx, input: value }).input;
        case 'param':
          if (value === undefined && !binding.optional) throw refused(binding.source.name, 'Required');

          return this.judged(binding.source, value);
        case 'query':
          return value;
        default:
          return BindingSources.resolve(binding.source.kind).given(binding.source, value, { ctx, scope: this.scope, input });
      }
    });
  }

  /**
   * The body, when it carries the change of a row the call designates rather than an input —
   * `PATCH /posts/:id/retitle { title }`. Only a FIELD of that row is read there: a plain
   * parameter never comes from a body. Once one is, a key naming no parameter is refused, the way
   * an input refuses one.
   */
  private static bodyOf(plan: BindingPlan, ctx: InvocationContext): Record<string, unknown> | undefined {
    if (plan.some((binding) => binding.source.kind === 'input')) return undefined;
    if (!ctx.input || typeof ctx.input !== 'object' || Array.isArray(ctx.input)) return undefined;

    const params = plan.flatMap(({ source }) => (source.kind === 'param' ? [source] : []));
    const designated = new Set(params.flatMap((param) => (param.identifies ? [param.identifies] : [])));
    const changed = params.filter((param) => !param.identifies && param.field && designated.has(param.field.entity));
    const body = ctx.input as Record<string, unknown>;
    const read = changed.some(({ name }) => ctx.params[name] === undefined && ctx.query[name] === undefined && body[name] !== undefined);
    if (!read) return undefined;

    const names = new Set(params.map((param) => param.name));
    const stranger = Object.keys(body).find((key) => !names.has(key));
    if (stranger !== undefined) throw refused(stranger, InputRefusal.unknownField);

    return Object.fromEntries(changed.map(({ name }) => [name, body[name]]));
  }

  /**
   * A value the caller typed in a path, a query string, or a body that carries parameters. `null`
   * is a value, not a miss: only `undefined` means absent, so `T | null` stays apart from `T | undefined`.
   */
  private static param(source: ParamSource, optional: boolean, ctx: InvocationContext, body?: Record<string, unknown>): unknown {
    const { name, coerce } = source;
    const value: unknown = [ctx.params[name], ctx.query[name], body?.[name]].find((one) => one !== undefined);

    if (value === undefined) {
      if (optional) return undefined;
      throw refused(name, 'Required');
    }
    if (value === null || coerce === undefined) return value;

    const coerced = coerce === 'number' ? ArgumentResolver.number(value) : ArgumentResolver.boolean(value);
    if (coerced === undefined) throw refused(name, `Expected a ${coerce}, got ${JSON.stringify(value)}`);

    return coerced;
  }

  /** `age: Sample['age']` obeys what `Sample.age` declares, after the query string was read. */
  private judged(source: ParamSource, value: unknown): unknown {
    if (value === undefined || !source.field) return value;

    const field = this.entities?.(source.field.entity)?.getFields()[source.field.name];
    if (!field) return value;

    const verdict = FieldValueValidator.of(field).parse(value);
    if ('message' in verdict) throw refused(source.name, verdict.message);

    return verdict.value;
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
