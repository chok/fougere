/**
 * Posts seed — creates drafts through the façade, then publishes one of them
 * through the same `publish` operation any client would call.
 *
 * The first version of this file set `status: 'published'` directly and the boot
 * refused it: `status: Read-only, publishedAt: Read-only`. That refusal is the
 * demo. A seed writes at boot from inside the process, and it still does not get
 * to reach a field the entity closed — the only way into `published` is the
 * operation, for a seed exactly as for a browser.
 *
 * Returns [] : everything is done here, nothing left for the boot loop.
 */
type Facade = Record<string, (invocation?: Record<string, unknown>) => Promise<any>>;

export default async (resolve: <T>(name: string) => T) => {
  const posts = resolve<Facade>('post');
  if ((await posts.list()).length > 0) return [];

  const items = [
    {
      title: 'One declaration, three hosts',
      body: 'This row was seeded by the frond, not by the app. The same fronds/ directory runs under Nuxt, Next and TanStack Start.',
      publish: true,
    },
    {
      title: 'Still a draft',
      body: 'Its status is readOnly, so no create or update can reach it — only the publish operation can.',
      publish: false,
    },
  ];

  for (const { publish, ...item } of items) {
    const created = await posts.create({ params: {}, query: {}, body: item, state: {} });
    if (publish) {
      await posts.publish({ params: { id: created.id }, query: {}, body: undefined, state: {} });
    }
  }

  return [];
};
