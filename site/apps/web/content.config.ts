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
    // What a page IS decides its frame: a concept ends on the tasks that use it, a task opens on
    // the concepts it uses. `uses` is written once, on the task; the concept's list is its reverse.
    docs: defineCollection({
      type: 'page',
      source: { include: 'docs/**' },
      schema: z.object({
        kind: z.enum(['intro', 'concept', 'task', 'extending']).optional(),
        step: z.number().optional(),
        uses: z.array(z.string()).optional(),
        forms: z.array(z.string()).optional(),
      }),
    }),
    reference: defineCollection({
      type: 'page',
      source: { include: 'reference/**' },
      // A config page also carries its file written whole, a note per key — `modules/reference.ts`.
      schema: z.object({
        file: z.object({
          name: z.string(),
          lines: z.array(z.object({ text: z.string(), key: z.string().optional() })),
          notes: z.record(z.string(), z.object({
            type: z.string(), optional: z.boolean(), doc: z.string(),
            links: z.array(z.object({ label: z.string(), path: z.string() })),
          })),
        }).optional(),
      }),
    }),
    // Written by `modules/tutorial.ts` from demos/tutorial — what each step changed, and what it grew.
    tutorial: defineCollection({
      type: 'page',
      source: { include: 'tutorial/**' },
      schema: z.object({
        step: z.number(),
        name: z.string(),
        slug: z.string(),
        heading: z.string(),
        concept: z.string(),
        lede: z.string(),
        fig: z.string(),
        files: z.array(z.object({ path: z.string(), state: z.string() })),
        code: z.array(z.object({
          path: z.string(),
          state: z.string(),
          lines: z.array(z.object({ text: z.string(), added: z.boolean(), keys: z.array(z.string()) })),
        })),
        grows: z.array(z.object({ key: z.string(), side: z.string(), label: z.string(), detail: z.string() })),
        tryIt: z.object({ command: z.string(), said: z.record(z.string(), z.string()), output: z.string() }).optional(),
        install: z.record(z.string(), z.string()).optional(),
        aside: z.string().optional(),
        zero: z.string().optional(),
        links: z.array(z.object({ title: z.string(), path: z.string() })),
      }),
    }),
  },
});
