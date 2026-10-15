import { defineContentConfig, defineCollection, z } from '@nuxt/content';

export default defineContentConfig({
  collections: {
    // The frontmatter `modules/demo.ts` writes. Declared because a field Content has no
    // column for cannot be selected — an undeclared `count` reads back as nothing.
    demo: defineCollection({
      type: 'page',
      source: { include: 'demo/**' },
      schema: z.object({
        name: z.string(),
        entry: z.string(),
        runnable: z.boolean(),
        count: z.number(),
      }),
    }),
    docs: defineCollection({
      type: 'page',
      source: { include: 'docs/**' },
    }),
  },
});
