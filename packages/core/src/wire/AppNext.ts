/** What a middleware holds: the rest of the chain, and the answer it will hand back. */
export type AppNext<T = unknown> = () => Promise<T>;
