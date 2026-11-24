import { defineFougere } from '@fougere/core';

export default defineFougere({
  processes: {
    blog: { url: 'http://127.0.0.1:4991/', fronds: ['blog'] },
    shop: { url: 'http://127.0.0.1:4992', fronds: ['shop'] },
  },
});
