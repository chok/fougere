/** Any class, whatever it takes — what a declaration names when it names one. */
export type Ctor = new (...args: never[]) => unknown;

/** A class that may be `abstract` — a port is one, and only its implementations are ever built. */
export type AbstractCtor = abstract new (...args: never[]) => unknown;
