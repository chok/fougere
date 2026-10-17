import { defineFrond } from '@fougere/core/node';

export default defineFrond({
  operations: {
    'article.onHand': { kind: 'query' },
  },
});
