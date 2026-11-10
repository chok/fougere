import { FieldValueValidator, InputRefusal, Shapes, type SchemaView, type Shape } from '@fougere/schema';
import type { InvocationContext } from '../wire/InvocationContext.js';
import type { BindingPlan } from '../wire/binding.js';
import { ErrorCode } from '../wire/ErrorCode.js';
import { FougereError } from '../wire/FougereError.js';
import type { Container } from '@fougere/container';
import type { EntityLookup } from './EntityLookup.js';
import { BindingSources } from '../extension/BindingSources.js';
import { validateInput } from './validateInput.js';
import { ListQuery } from './ListQuery.js';

type ParamSource = Extract<BindingPlan[number]['source'], { kind: 'param' }>;

/** Resolves an operation's declared binding plan against one invocation. */
export class ArgumentResolver {
  constructor(
    private readonly scope?: Container,
    private readonly entities?: EntityLookup,
  ) {}

  async resolve(plan: BindingPlan, ctx: InvocationContext, output?: SchemaView): Promise<unknown[]> {
    const args: unknown[] = [];
    const body = ArgumentResolver.bodyOf(plan, ctx);

    for (const binding of plan) {
      switch (binding.source.kind) {
        case 'context': {
          args.push(ctx);
          break;
        }
        case 'param': {
          args.push(this.validatedByField(binding.source, ArgumentResolver.param(binding.source, binding.optional, ctx, body)));
          break;
        }
        case 'input': {
          if (ctx.input === undefined && !binding.optional) throw refused(binding.name, 'Required');
          args.push(ctx.input);
          break;
        }
        case 'query': {
          args.push(ListQuery.read(ctx.query, output?.getFields()));
          break;
        }
        default: {
          const source = BindingSources.resolve(binding.source.kind);
          const call = { ctx, scope: this.scope };
          const value = await source.resolve(binding.source, call);
          if (value === undefined && !binding.optional) {
            source.missing?.(binding.source, call);
            throw refused(binding.name, 'Required');
          }
          args.push(value);
        }
      }
    }

    return args;
  }

  /** The arguments code wrote, judged as a door would have judged them. */
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

          return this.validatedByField(binding.source, value);
        case 'query':
          return value;
        default:
          return BindingSources.resolve(binding.source.kind).given(binding.source, value, { ctx, scope: this.scope, input });
      }
    });
  }

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

  private static param(source: ParamSource, optional: boolean, ctx: InvocationContext, body?: Record<string, unknown>): unknown {
    const { name, coerce } = source;
    const value: unknown = [ctx.params[name], ctx.query[name], body?.[name]].find((one) => one !== undefined);

    if (value === undefined) {
      if (optional) return undefined;
      throw refused(name, 'Required');
    }
    if (value === null || coerce === undefined) return value;

    const coerced = Shapes.fromText(ArgumentResolver.SHAPES[coerce], value);
    if (typeof coerced !== coerce) throw refused(name, `Expected a ${coerce}, got ${JSON.stringify(value)}`);

    return coerced;
  }

  private static readonly SHAPES = { number: { type: 'number' }, boolean: { type: 'boolean' } } as const satisfies Record<string, Shape>;

  private validatedByField(source: ParamSource, value: unknown): unknown {
    if (value === undefined || !source.field) return value;

    const field = this.entities?.(source.field.entity)?.getFields()[source.field.name];
    if (!field) return value;

    const parsed = FieldValueValidator.of(field).parse(value);
    if ('message' in parsed) throw refused(source.name, parsed.message);

    return parsed.value;
  }

}

function refused(name: string, message: string): FougereError {
  return new FougereError({
    code: ErrorCode.VALIDATION_FAILED,
    message: `${name}: ${message}`,
    details: [{ path: [name], message }],
  });
}
