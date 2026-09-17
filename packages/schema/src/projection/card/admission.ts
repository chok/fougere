import { Shapes } from '../../axis/shape/Shape.js';
import { SchemaError } from '../../SchemaError.js';

/**
 * Throws with what is wrong AND what to write: a card's author is in another process.
 * FR : lève avec ce qui cloche ET quoi écrire : l'auteur d'une carte est ailleurs.
 * `refuse('role.relation.kind is "maybe"', 'Expected one of one, many.')`
 */
export function refuse(what: string, fix: string): never {
  throw new SchemaError(`This card cannot be read: ${what}.\n  ${fix}`);
}

/**
 * Compiles every `pattern` at the facade, so a bad one is refused here and not at the first row.
 * FR : compile chaque `pattern` à la porte : un mauvais est refusé ici, pas au premier row.
 * `{ type: 'string', pattern: '(' }` → `Field 'code' states pattern: "(", which is not a regular expression`
 */
export function admitPatterns(shape: unknown, subject: string): void {
  for (const pattern of Shapes.patterns(shape)) {
    try {
      // The engine compiles it with `u` and only when a row arrives, so nothing but this
      // reads it early enough to name the card it came from.
      new RegExp(pattern, 'u');
    } catch (error) {
      refuse(
        `${subject} states \`pattern: ${JSON.stringify(pattern)}\`, which is not a regular expression`,
        (error as Error).message,
      );
    }
  }
}
