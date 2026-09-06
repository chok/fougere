import type { ValidationError } from '../../validation.js';
import { Shapes } from '../../axis/shape/Shape.js';

/**
 * So a card that cannot be read says what is wrong and what to write instead.
 * FR : pour qu'une carte illisible dise ce qui cloche et quoi écrire.
 * `refuse('role.relation.kind is "maybe"', 'Expected one of one, many.')`
 */
export function refuse(what: string, fix: string): never {
  throw new Error(`This card cannot be read: ${what}.\n  ${fix}`);
}

/**
 * So a card's axis passes the same validator as a hand-written one, and no second validator exists.
 * FR : pour qu'un axe d'une carte passe le juge des autres, sans second juge.
 * `{ update: 'maybe' }` on a card → `lifecycle is malformed — lifecycle.update: Expected 'now' or 'forbidden'`
 */
export function admitWire(
  validator: (value: unknown, errors: ValidationError[]) => void,
  value: unknown,
  slot: string,
): void {
  const errors: ValidationError[] = [];
  validator(value, errors);
  if (errors.length) {
    refuse(
      `${slot} is malformed — ${errors.map((e) => `${e.path}: ${e.message}`).join('; ')}`,
      'A card states an axis the way a declaration does.',
    );
  }
}

/**
 * So a closed set is checked against the list that declares it, never against a copy.
 * FR : pour qu'un ensemble fermé soit vérifié contre la liste qui le déclare.
 * `oneOfTokens('many', RELATION_KINDS)` → `true`
 */
export const oneOfTokens = <T extends readonly string[]>(
  value: unknown,
  tokens: T,
): value is T[number] => typeof value === 'string' && (tokens as readonly string[]).includes(value);

/**
 * So a `pattern` the engine cannot compile is refused where the card is read, not at the first row.
 * FR : pour qu'un `pattern` incompilable soit refusé à la lecture de la carte, pas au premier row.
 * `{ type: 'string', pattern: '(' }` → Field 'code' states `pattern: "("`, which is not a regular expression
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
