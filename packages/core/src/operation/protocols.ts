import { subjectKeyOf } from '../descriptor/bases.js';
import { OperationOverrides } from '../descriptor/OperationOverrides.js';
import { Protocols } from '../extension/Protocol.js';
import type { FougereOperationProtocols } from '../descriptor/FougereOperationProtocols.js';
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';
import type { DeclaredAnswer } from '../descriptor/DeclaredAnswer.js';

/** What the op says to each protocol this process serves, with the answers its door links declare. */
export function protocolsOf(frond: FrondDescriptor, address: string, operation: string): FougereOperationProtocols {
  const entry = { ...OperationOverrides.of(frond).get(address, operation) } as Record<string, Record<string, unknown> | undefined>;
  for (const { door, answers } of declaredAt(frond, address, operation)) {
    const said = entry[door]?.responses as DeclaredAnswer[] | undefined;
    entry[door] = { ...entry[door], responses: [...(said ?? []), ...answers] };
  }

  return Object.fromEntries(Object.entries(entry).filter(([key]) => Protocols.find(key))) as FougereOperationProtocols;
}

function declaredAt(frond: FrondDescriptor, address: string, operation: string): { door: string; answers: DeclaredAnswer[] }[] {
  const handlers = frond.handlers.filter((one) => one.address === address).map((one) => one.name);

  return Protocols.entries.flatMap(([door, type]) => {
    if (!type.port) return [];
    const keys = new Set(handlers.map((handler) => subjectKeyOf(type.port!, handler)));

    return frond.providers.flatMap((provider) => {
      const answers = provider.answers?.[operation];

      return answers && provider.implements?.some((key) => keys.has(key)) ? [{ door, answers }] : [];
    });
  });
}
