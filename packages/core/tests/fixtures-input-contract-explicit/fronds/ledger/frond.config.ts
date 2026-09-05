import Account from './entities/Account.js';

export default {
  operations: {
    // Selecting a validator does not choose between two object parameters. This plan is
    // intentionally explicit: both receive the one input, because that is what this
    // fixture's handler declares it wants.
    settle: {
      input: Account,
      binding: [
        { name: 'source', source: { kind: 'input' }, optional: false },
        { name: 'destination', source: { kind: 'input' }, optional: false },
      ],
    },
  },
};
