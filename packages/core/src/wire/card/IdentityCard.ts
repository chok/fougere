import type { SchemaDescriptor } from '@fougere/schema';
import { ErrorCode } from '../ErrorCode.js';
import { FougereError } from '../FougereError.js';
import type { CardOp } from './CardOp.js';

/** What an app hosts — the wire projection of its scanned fronds. */
export interface IdentityCard {
  fronds: {
    name: string;
    facades: {
      name: string;
      ops: CardOp[];
      /** The shape stored under this name — **absent when nothing is**. */
      schema?: SchemaDescriptor;
    }[];
    /** The facts this frond ANNOUNCES — one entry per `Emit<T>` its handlers inject. */
    facts: { name: string; schema?: SchemaDescriptor }[];
  }[];
}

/** The shape a card must have to be walked — `fronds`, and each frond's `facades`. */
export function assertIdentityCard(value: unknown, source: string): IdentityCard {
  const card = value as IdentityCard | undefined;
  const fronds = Array.isArray(card?.fronds) ? card.fronds : undefined;
  if (!fronds) throw cardRefusal(source, 'no fronds array');
  for (const frond of fronds) {
    if (!frond || typeof frond.name !== 'string') throw cardRefusal(source, 'a frond with no name');
    if (!Array.isArray(frond.facades)) throw cardRefusal(source, `frond '${frond.name}' has no valid facades array`);
  }
  return card as IdentityCard;
}

function cardRefusal(source: string, what: string): FougereError {
  return new FougereError({
    code: ErrorCode.INTERNAL_ERROR,
    message:
      `${source} answered an invalid identity card: ${what}.\n`
      + `  A card is what tells this process what the other one hosts, so nothing can be routed from it.\n`
      + `  - Check that the address serves a Fougere app, and that its version still speaks this card.`,
  });
}
