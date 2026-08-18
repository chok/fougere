import { defineFougere } from '@fougere/core';

/**
 * Two classes extend `Payment`, so the boot refuses to pick one on its own. This line
 * is the whole statement — beside `remotes:` (where a call goes) and `sources:` (where
 * a row is), because it says who performs an action.
 *
 * Comment it out and run again: the boot names both classes and stops.
 */
export default defineFougere({
  db: false,
  ports: { Payment: 'StripePayment' },
});
