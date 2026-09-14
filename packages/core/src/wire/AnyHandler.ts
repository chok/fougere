/** A facade whose operations no type describes — an ungenerated project's, and a form's. */
export type AnyHandler = Record<string, (...args: never[]) => Promise<unknown>>;
