// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface FougereStates {}

/** One name of `state:` — kept one way, with what that way is told: `{ cookie: { maxAge: '7d' } }`. */
export type StateEntry = { [Type in keyof FougereStates]: { [Only in Type]: FougereStates[Type] } }[keyof FougereStates];
