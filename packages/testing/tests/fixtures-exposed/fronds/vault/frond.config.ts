import { defineFrond } from '@fougere/core';

/** Nothing is public. REST and GraphQL read this; the runner does not. */
export default defineFrond({ expose: [] });
