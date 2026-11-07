import { Shapes } from '../../axis/shape/Shape.js';
import type { JsonSchema } from '../../lib/JsonSchema.js';
import { dotted } from '../../lib/ValidationResult.js';
import { JsonSchemaValidator } from '../../validator/JsonSchemaValidator.js';
import type { CardForm } from './CardForm.js';
import { SchemaError } from '../../SchemaError.js';

/** Refuses a card, saying what is wrong and what to write. */
export function refuse(what: string, fix: string): never {
  throw new SchemaError(`The description received from the other process cannot be read: ${what}.\n  ${fix}`);
}

/** Refuses a `pattern` that does not compile, before any row arrives. */
export function admitPatterns(shape: unknown, subject: string): void {
  for (const pattern of Shapes.patterns(shape)) {
    try {
      new RegExp(pattern, 'u');
    } catch (error) {
      refuse(
        `${subject} states \`pattern: ${JSON.stringify(pattern)}\`, which is not a regular expression`,
        (error as Error).message,
      );
    }
  }
}

/** Judges what a card wrote for an axis against the form that writes it, before it is rebuilt. */
export function admitAxis(form: CardForm, wire: unknown, subject: string, axis: string): void {
  const refusal = JsonSchemaValidator.of(form.format.schema as JsonSchema).refusalOf(wire, [axis]);

  if (refusal) throw new SchemaError(`${subject}: ${dotted(refusal.path)}: ${refusal.message}`);
}
