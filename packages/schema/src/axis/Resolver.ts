export type Resolver = (name: string) => (abstract new (...args: never[]) => unknown) | undefined;
