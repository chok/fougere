import { InputValidator, dotted, optional, type Field, type Fields } from '@fougere/schema';
import { ErrorCode } from './ErrorCode.js';
import { FougereError } from './FougereError.js';

/** An extension and the members it puts on a call's `state`. */
export interface StateDeclaration {
  name: string;
  state?: Readonly<Record<string, Field>>;
}

/**
 * What a call's `state` may hold in this process: the members its extensions declare, each one
 * absent until a host fills it. Judged at the facade, so a member arriving over the wire is
 * rebuilt by its field exactly as it would have been handed over in-process.
 *
 * Documented: [collectors](https://fougere.dev/docs/business/collectors).
 */
export class StateShape {
  static readonly empty = new StateShape({});

  private readonly validator: InputValidator;

  private constructor(private readonly fields: Fields) {
    this.validator = InputValidator.of(fields);
  }

  /** Two extensions declaring one member refuse: the field that judges it would depend on wiring order. */
  static of(declarations: readonly StateDeclaration[]): StateShape {
    const fields: Fields = {};
    const owners = new Map<string, string>();
    for (const { name, state } of declarations) {
      for (const [member, field] of Object.entries(state ?? {})) {
        const owner = owners.get(member);
        if (owner) {
          throw new Error(
            `[state] '${member}' is declared by two extensions, '${owner}' and '${name}'.\n`
            + '  A member has one owner — keep one of them out of `extensions:`.',
          );
        }
        owners.set(member, name);
        fields[member] = optional(field);
      }
    }

    return new StateShape(fields);
  }

  /**
   * The members written since `entered` rebuilt by their fields, or a refusal naming the member
   * and what this process declares. What `entered` already held was judged where it entered.
   */
  judge(
    state: Record<string, unknown>,
    entity: string,
    operation: string,
    entered: Record<string, unknown> = {},
  ): Record<string, unknown> {
    const written = Object.fromEntries(Object.entries(state).filter(([member, value]) => entered[member] !== value));
    if (Object.keys(written).length === 0) return state;

    const result = this.validator.validate(written);
    if (result.success) return { ...state, ...result.data };

    const declared = Object.keys(this.fields);
    const errors = result.errors.map((error) => ({ ...error, path: ['state', ...error.path] }));

    throw new FougereError({
      code: ErrorCode.VALIDATION_FAILED,
      message: errors.map((error) => `${dotted(error.path)}: ${error.message}`).join(', ')
        + (declared.length ? ` — this process declares ${declared.join(', ')}` : ' — this process declares no state member'),
      details: errors,
      entity,
      operation,
    });
  }
}
