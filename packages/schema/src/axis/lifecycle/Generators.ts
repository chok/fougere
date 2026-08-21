export type GeneratorRef = 'cuid2' | 'uuid' | 'nanoid' | (string & {});

const generators = new Map<string, () => string>();

export function registerGenerator(name: string, fn: () => string): void {
  generators.set(name, fn);
}

export function resolveCustomGenerator(ref: GeneratorRef): (() => string) | undefined {
  return generators.get(ref);
}
