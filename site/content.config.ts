import { defineContentConfig, defineCollection } from '@nuxt/content';

export default defineContentConfig({
  collections: {
    docs_en: defineCollection({
      type: 'page',
      source: { include: 'en/docs/**', prefix: '/docs' },
    }),
    docs_fr: defineCollection({
      type: 'page',
      source: { include: 'fr/docs/**', prefix: '/fr/docs' },
    }),
  },
});
