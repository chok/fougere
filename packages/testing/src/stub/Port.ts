/** Anything a provider can be declared as: a class the container knows how to build. */
export type Port = abstract new (...args: never[]) => unknown;
