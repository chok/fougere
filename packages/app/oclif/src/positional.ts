import { RouteAddress, type FrondDescriptor } from '@fougere/core';

declare module '@fougere/core' {
  interface FougereOperationProtocols {
    /**
     * How the terminal reads the op: the parameters given by position, the rest by flag.
     * Ex: `{ positional: ['process'] }`.
     */
    terminal?: { positional?: readonly string[] };
  }
}

/** The parameters `frond.config.ts` gives by position for an op; absent, the first required text is. */
export function positionalOf(frond: FrondDescriptor, address: string, operation: string): readonly string[] | undefined {
  return frond.operationsOverrides?.[new RouteAddress({ address, operation }).toString()]?.terminal?.positional;
}
