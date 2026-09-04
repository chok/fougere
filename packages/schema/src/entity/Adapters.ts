import type { EntryJudge } from '../judge/EntryJudge.js';
import { Registry } from '../Registry.js';

/**
 * Which adapters this process answers for, and what each accepts under a field name.
 * `EntityAdapterSet` owns the two levels an entry is addressed by; this owns the first.
 */
export const Adapters = new Registry<EntryJudge>('adapter', 'import the adapter that answers it');
