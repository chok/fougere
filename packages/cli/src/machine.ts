/**
 * A command's machine output — the one shape a pipe reads.
 *
 * There is no list of commands here: `json` is declared by an entity like any other
 * field, so a command that declares it gets the door. The runner used to name `explain`
 * in an `if`, and `graph --json` announced a flag it then ignored.
 */
export function machineWanted(raw: Record<string, unknown>): boolean {
  return raw.json === true || typeof raw.names === 'string';
}

/**
 * A `Map` serializes to `{}`, so the door converts it rather than each command flattening
 * its own result: `GraphResult.nodes` is a Map, and `graph --json` would have printed a
 * report with an empty graph in it.
 */
export function machineText(value: unknown): string {
  return JSON.stringify(value, (_key, held) => (held instanceof Map ? Object.fromEntries(held) : held), 2);
}

export function printMachine(value: unknown): void {
  process.stdout.write(machineText(value) + '\n');
}
