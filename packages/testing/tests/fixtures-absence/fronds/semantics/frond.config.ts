export default {
  operations: {
    // Its name deliberately carries no convention; the test needs the custom-operation
    // mutation shape shared by the GraphQL facade harness.
    inspect: { kind: 'command' },
  },
};
