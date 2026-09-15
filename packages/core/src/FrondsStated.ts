/**
 * What the config says about the fronds this app is made of — where each one comes from, and
 * which one it inherits code from.
 *
 * Nesting says ONE thing: `shop: { cart: {} }` means `cart` resolves what `shop` declared.
 * It says nothing about placement, and nothing about the right to call — two fronds reach each
 * other through a façade or an announced fact, wherever they sit in here.
 *
 * Documented: [fronds](https://fougere.dev/docs/infra/fronds).
 */
export type FrondsStated = { readonly [frond: string]: FrondStated };

/** Its children, or the one string that says where it comes from. */
export type FrondStated = FrondsStated | string;

/**
 * A key that names a module rather than a frond. A frond's name is a directory name or the
 * `fougere.frond` field of a package, and neither can hold a separator — so the two never
 * collide, and no allow-list of short names has to be kept anywhere.
 */
export function statesModule(key: string): boolean {
  return key.includes('/') || key.startsWith('.');
}

/** One entry of the tree, flattened. */
export interface StatedFrond {
  /** The key as written — a frond name, or a module specifier. */
  key: string;
  /** Who it inherits code from, absent at the top level. */
  under?: string;
  /** Its children's key, for a refusal that names where it sits. */
  path: string;
  /** An address for a frond that is elsewhere, an argument for a module. */
  value?: string;
}

/**
 * Every frond the tree states, parents before their children — which is also the order a boot
 * has to install them in, since a child's scope hangs off its parent's.
 *
 * A name stated twice is reported rather than resolved: which one a frond inherits from would
 * otherwise depend on reading order.
 */
export function statedFronds(stated: FrondsStated | undefined): {
  fronds: StatedFrond[];
  twice: { key: string; paths: [string, string] }[];
} {
  const fronds: StatedFrond[] = [];
  const seen = new Map<string, string>();
  const twice: { key: string; paths: [string, string] }[] = [];

  const walk = (level: FrondsStated, under: string | undefined, prefix: string): void => {
    for (const [key, value] of Object.entries(level)) {
      const path = prefix ? `${prefix}.${key}` : key;
      const first = seen.get(key);
      if (first !== undefined) {
        twice.push({ key, paths: [first, path] });
        continue;
      }

      seen.set(key, path);
      fronds.push({
        key,
        path,
        ...(under !== undefined ? { under } : {}),
        ...(typeof value === 'string' ? { value } : {}),
      });
      if (typeof value !== 'string') walk(value, key, path);
    }
  };

  walk(stated ?? {}, undefined, '');

  return { fronds, twice };
}

/**
 * Two levels of the cascade, folded. Nesting merges by KEY and all the way down — a config that
 * adds one frond under `shop` may not erase the family the workspace declared.
 */
export function mergeStated(base: FrondsStated, override: FrondsStated): FrondsStated {
  const merged: Record<string, FrondStated> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const mine = merged[key];
    merged[key] = typeof value === 'string' || typeof mine === 'string' || mine === undefined
      ? value
      : mergeStated(mine, value);
  }

  return merged;
}
