import { Registry } from '@fougere/registry';
import { JsonSchemaValidator, SchemaError, dotted, type JsonSchema } from '@fougere/schema';
import type { StateKeeper } from './StateKeeper.js';

/** One name of `state:`, its keeper resolved and what it is told judged. */
export interface DeclaredState {
  name: string;
  type: string;
  options: unknown;
  keeper: StateKeeper;
}

class StateRegistry extends Registry<StateKeeper> {
  /** Every name `state:` declares — one way to keep each, registered, and told what its format admits. */
  declared(state: Record<string, object> = {}): DeclaredState[] {
    return Object.entries(state).map(([name, entry]) => {
      const types = Object.keys(entry);
      if (types.length !== 1) {
        throw new SchemaError(`state.${name} names ${types.length} ways to keep it — name one: ${this.names.join(', ') || 'none, import @fougere/state-cookie'}.`);
      }
      const [type] = types as [string];
      const keeper = this.resolve(type, `state.${name}`);
      const options = (entry as Record<string, unknown>)[type];
      const refusal = JsonSchemaValidator.of(keeper.format.schema as JsonSchema).refusalOf(options, ['state', name, type]);
      if (refusal) throw new SchemaError(`${dotted(refusal.path)}: ${refusal.message}`);

      return { name, type, options, keeper };
    });
  }
}

/**
 * The ways a caller's state can be kept, by the word `state:` names them with — `cookie`, brought by
 * `@fougere/state-cookie`. Core keeps none: what a value travels in is a door's, never core's.
 */
export const States = new StateRegistry('state keeper', 'import the package that keeps it, @fougere/state-cookie for `cookie`');
