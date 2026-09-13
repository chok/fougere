import { Generators } from '@fougere/schema';

/** A word this frond adds to the declaration. The entity beside it writes `generate: 'ulid'`. */
Generators.register('ulid', () => `ulid-${Date.now().toString(36)}`);
