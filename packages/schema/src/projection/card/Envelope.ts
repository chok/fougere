/** What every card document carries: the format it speaks, and who wrote it. */
export const ENVELOPE = { 'x-fougere-version': 1, 'x-fougere-vendor': 'fougere' } as const;

export type Envelope = typeof ENVELOPE;
