import { createLocalRunner, identityCardOf, RPC_ENTITY, type App, type Transport } from '@fougere/core';

/** What HTTP is, minus the socket: the far app, and a count of what actually reached it. */
export function memory(far: App) {
  const runner = createLocalRunner(far);
  const card = identityCardOf(far);
  const reached: string[] = [];

  const transport: Transport = async (call, invocation) => {
    if (call.entity === RPC_ENTITY) return card;
    reached.push(`${call.entity}.${call.op}`);

    return runner(call, invocation);
  };

  return { transport, reached };
}
