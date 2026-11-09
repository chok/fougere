import { Transports, type CallIdentity, type TransportType } from '@fougere/core';
import { createHttpTransport } from './client.js';

/** What a Worker binds, read off `env` at the first call, since nothing hands it over sooner. */
type Bindings = Record<string, { fetch?: (request: Request) => Promise<Response> } | undefined>;

const http: TransportType = {
  open: (address, identity) => createHttpTransport(address.href, signedBy(identity)),
};

/**
 * `binding://CATALOG` — the same envelope, carried by the Worker's service binding named `CATALOG`,
 * which is the only way two Workers of one account reach each other.
 */
export function bindingOver(env: () => Promise<Bindings>): TransportType {
  return {
    open: (address, identity) => {
      const name = address.host;
      let bound: Promise<(request: Request) => Promise<Response>> | undefined;

      return createHttpTransport(`https://${name}`, {
        ...signedBy(identity),
        fetch: async (input, init) => {
          const send = await (bound ??= bindingNamed(name, env));

          return send(new Request(input, init));
        },
      });
    },
  };
}

async function workersEnv(): Promise<Bindings> {
  const workers = 'cloudflare:workers';
  const { env } = (await import(workers).catch(() => {
    throw new Error('binding:// needs cloudflare:workers, and this is not a Cloudflare Worker.');
  })) as { env: Bindings };

  return env;
}

async function bindingNamed(name: string, env: () => Promise<Bindings>): Promise<(request: Request) => Promise<Response>> {
  const service = (await env())[name];
  if (!service?.fetch) throw new Error(`This Worker has no service binding named '${name}'. Add it to wrangler.toml.`);

  return (request) => service.fetch!(request);
}

function signedBy(identity: CallIdentity): { sign?: CallIdentity['sign'] } {
  return identity.sign ? { sign: identity.sign } : {};
}

Transports.register('http', http);
Transports.register('https', http);
Transports.register('binding', bindingOver(workersEnv));
