import { defineFougere } from '@fougere/core';

export default defineFougere({
  fronds: {
    blog: { remote: 'http://127.0.0.1:4991/' },
    shop: { remote: 'http://127.0.0.1:4992' },
  },
});
