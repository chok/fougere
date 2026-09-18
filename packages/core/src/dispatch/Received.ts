/** What a facade puts back into an answer before handing it to its caller, read per operation. */
export type Received = (operation: string, answer: unknown) => unknown;
