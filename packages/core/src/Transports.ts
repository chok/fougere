import { Registry } from '@fougere/registry';
import { SchemaError } from '@fougere/schema';
import type { CallIdentity } from './CallIdentity.js';
import type { Transport } from './wire/Transport.js';

/**
 * What carries a call to an address whose scheme names it — `http` for `remote: 'http://…'`.
 *
 * Documented: [extension points](https://fougere.dev/docs/extending/extension-points).
 */
export interface TransportType {
  open(address: URL, identity: CallIdentity): Transport;
}

/** Which package answers a scheme — one per process, the way a source type is. */
class TransportRegistry extends Registry<TransportType> {
  /** The transport an address stands for, refused under `path` when no package answers its scheme. */
  open(address: string, identity: CallIdentity, path: string): Transport {
    const url = urlOf(address, path);
    const scheme = url.protocol.slice(0, -1);

    return this.resolve(scheme, path).open(url, identity);
  }
}

function urlOf(address: string, path: string): URL {
  try {
    return new URL(address);
  } catch {
    throw new SchemaError(`${path}: '${address}' is not an address — write it with its scheme, as in 'http://127.0.0.1:4100'.`);
  }
}

export const Transports = new TransportRegistry('transport', 'import the package that provides it');

/**
 * One transport per address `remotes` names, opened at boot so an unknown scheme refuses the boot
 * rather than the first call — the table the router and the relation readings both read.
 */
export function transportsOf(
  remotes: Record<string, string>,
  open: (address: string, label: string) => Transport,
): (address: string) => Transport {
  const opened = new Map<string, Transport>();
  for (const [label, address] of Object.entries(remotes)) {
    if (!opened.has(address)) opened.set(address, open(address, label));
  }

  return (address) => {
    const transport = opened.get(address);
    if (!transport) throw new Error(`No transport was opened for '${address}': \`fronds:\` names no frond there.`);

    return transport;
  };
}
