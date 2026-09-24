export default {
  operations: {
    doublePlain: { kind: 'query' },
    // An alias is not enough evidence to guess primitive/input/collector provenance.
    doubleCents: {
      kind: 'query',
      binding: [{
        name: 'amount',
        source: { kind: 'param', name: 'amount', coerce: 'number' },
        optional: false,
      }],
    },
  },
};
