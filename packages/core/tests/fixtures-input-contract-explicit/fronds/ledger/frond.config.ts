import Account from './entities/Account.js';

export default {
  operations: {
    // Selecting a judge does not choose between two object parameters. This plan is
    // intentionally explicit: both receive the one body, because that is what this
    // fixture's handler declares it wants.
    settle: {
      input: Account,
      binding: [
        { name: 'source', source: { kind: 'body' }, optional: false },
        { name: 'destination', source: { kind: 'body' }, optional: false },
      ],
    },
  },
};
