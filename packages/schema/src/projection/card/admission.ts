import type { ValidationError } from '../../lib/validation.js';
import { Shapes } from '../../axis/shape/Shape.js';
import { dotted } from '../../lib/validation.js';

/**
 * Throws with what is wrong AND what to write: a card's author is in another process.
 * FR : lève avec ce qui cloche ET quoi écrire : l'auteur d'une carte est ailleurs.
 * `refuse('role.relation.kind is "maybe"', 'Expected one of one, many.')`
 */
export function refuse(what: string, fix: string): never {
  throw new Error(`This card cannot be read: ${what}.\n  ${fix}`);
}

/**
 * Runs a card's axis through the validator a hand-written field goes through, so there is
 * one judge and not two.
 * FR : passe l'axe d'une carte par le juge d'un champ écrit à la main : un juge, pas deux.
 * `{ update: 'maybe' }` → `lifecycle is malformed — lifecycle.update: Expected 'now' or 'forbidden'`
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
      `${slot} is malformed — ${errors.map((e) => `${dotted(e.path)}: ${e.message}`).join('; ')}`,
      'A card states an axis the way a declaration does.',
    );
  }
}

/**
 * Checks a token against the list that declares it, never against a copy written here.
 * FR : vérifie un mot contre la liste qui le déclare, jamais contre une copie locale.
 * `oneOfTokens('many', RELATION_KINDS)` → `true`
 */
export const oneOfTokens = <T extends readonly string[]>(
  value: unknown,
  tokens: T,
): value is T[number] => typeof value === 'string' && (tokens as readonly string[]).includes(value);

/**
 * Compiles every `pattern` at the door, so a bad one is refused here and not at the first row.
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
