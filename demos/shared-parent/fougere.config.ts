export default {
  db: false,
  fronds: {
    // `billing` serves nothing. It holds what its family shares, and the two below
    // resolve it — comment the nesting out and their first call finds no `Money`.
    billing: { fronds: ['cart', 'invoice'] },
  },
};
