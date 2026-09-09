import type { FrondDescriptor, HandlerEntry } from './frond.js';

/**
 * The surfaces a handler answers on — its own when it has one, otherwise the default
 * and every surface that names its address without opening a door of its own.
 * `undefined` is the default surface, as `facadeKeyOf` and `RouteAddress` spell it.
 */
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
