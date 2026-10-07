/** Where something answers — in this process, or a process away. */
export const PLACEMENTS = ['local', 'remote'] as const;

export type Placement = (typeof PLACEMENTS)[number];
