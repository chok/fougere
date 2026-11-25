import type { FougereConfig } from './FougereConfig.js';
import { Topology } from './Topology.js';
import type { ServiceBase } from '../extension/ServiceConfig.js';

/**
 * The variable that gives a service's address, read the way the `env` source reads a value's url.
 * Ex: `meili` is `MEILI_URL`.
 */
export function addressVariableOf(service: string): string {
  return `${service.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_URL`;
}

/** Where a service answers, on the machine `fougere up` starts it on. */
export function serviceAddressOf(entry: Pick<ServiceBase, 'port' | 'scheme'>): string {
  return `${entry.scheme ?? 'http'}://127.0.0.1:${entry.port}`;
}

/**
 * What a process is told by whoever starts it: its name, where it listens, where its neighbours answer, and every service's address.
 * Ex: `{ FOUGERE_PROCESS: 'blog', FOUGERE_LISTEN: '127.0.0.1:4100', FOUGERE_PEERS: '{"mail":"http://…"}', MEILI_URL: 'http://127.0.0.1:7700' }`.
 */
export function environmentOf(
  config: Pick<FougereConfig, 'processes' | 'services' | 'platform' | 'apps'>,
  name?: string,
  given: Record<string, string | undefined> = process.env,
): Record<string, string> {
  const entries = Object.entries(config.services ?? {}) as [string, ServiceBase][];
  const services = Object.fromEntries(entries.map(([service, entry]) => {
    const variable = addressVariableOf(service);

    return [variable, given[variable] ?? serviceAddressOf(entry)];
  }));
  if (name === undefined) return services;

  const placement = Topology.of(config).placement(name);
  const listen = new URL(placement.url as string);

  return {
    FOUGERE_PROCESS: name,
    FOUGERE_LISTEN: `${listen.hostname}:${listen.port}`,
    FOUGERE_PEERS: JSON.stringify(placement.remotes),
    ...services,
  };
}
