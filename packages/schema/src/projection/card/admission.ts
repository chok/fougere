import type { ValidationError } from '../../judge/result.js';

/**
 * So a card that cannot be read says what is wrong and what to write instead.
 * FR : pour qu'une carte illisible dise ce qui cloche et quoi écrire.
 * `refuse('role.relation.kind is "maybe"', 'Expected one of one, many.')`
 */
export function refuse(what: string, fix: string): never {
  throw new Error(`This card cannot be read: ${what}.\n  ${fix}`);
}

/**
 * So a card's axis passes the same judge as a hand-written one, and no second judge exists.
 * FR : pour qu'un axe d'une carte passe le juge des autres, sans second juge.
 * `{ update: 'maybe' }` on a card → `lifecycle is malformed — lifecycle.update: Expected 'now' or 'forbidden'`
 */
export function admitWire(
  judge: (value: unknown, errors: ValidationError[]) => void,
  value: unknown,
  slot: string,
): void {
  const errors: ValidationError[] = [];
  judge(value, errors);
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
