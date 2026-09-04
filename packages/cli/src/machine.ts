/** A command's machine output — the one shape a pipe reads. */
export function machineWanted(raw: Record<string, unknown>): boolean {
  return raw.json === true || typeof raw.names === 'string';
}

/** A `Map` serializes to `{}`, so the door converts it rather than each command flattening its own r… */
export function machineText(value: unknown): string {
  return JSON.stringify(value, (_key, held) => (held instanceof Map ? Object.fromEntries(held) : held), 2);
}

export function printMachine(value: unknown): void {
  process.stdout.write(machineText(value) + '\n');
}
