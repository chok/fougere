import { Generators } from '@fougere/schema';

/** A word this frond adds to the declaration. The entity beside it writes `generate: 'ulid'`. */
export const ulid = Generators.term('ulid', () => `ulid-${Date.now().toString(36)}`);
