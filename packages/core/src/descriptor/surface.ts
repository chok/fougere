import type { FrondDescriptor } from './FrondDescriptor.js';
import type { HandlerEntry } from './HandlerEntry.js';

/** The surfaces a handler answers on; `undefined` is the default surface. */
export function servedSurfaces(
  frond: FrondDescriptor,
  handler: HandlerEntry,
): (string | undefined)[] {
  if (handler.surface) return [handler.surface];

  const declared = Object.entries(frond.surfaces ?? {})
    .filter(([surface, addresses]) =>
      addresses.some((address) => address.toLowerCase() === handler.address.toLowerCase())
      && !frond.handlers.some((other) =>
        other.address === handler.address && other.surface === surface))
    .map(([surface]) => surface)
    .sort();

  return [undefined, ...declared];
}
