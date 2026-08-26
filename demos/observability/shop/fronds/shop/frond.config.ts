import { defineFrond } from '@fougere/core/node';

/**
 * `report` leads with no known verb, and the demo wants the name — a report is what a
 * dashboard reads. Config is the third producer of an operation contract, and this is
 * the whole declaration needed: the kind the verb list could not derive.
 */
export default defineFrond({
  operations: {
    report: { kind: 'query' },
  },
});
