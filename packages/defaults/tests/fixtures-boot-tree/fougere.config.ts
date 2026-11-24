export default {
  fronds: {
    shop: {},
    cart: { extends: 'shop' },
  },
  processes: { blog: { url: 'http://127.0.0.1:4321', fronds: ['blog'] } },
};
