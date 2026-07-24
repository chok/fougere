/**
 * Posts seed — creates drafts through the façade, then publishes most of
 * them through the same publish operation as everyone else (server-side
 * code owns the invocation, so it stamps the author as the acting user).
 * Returns [] : everything is done here, nothing left for the boot loop.
 */
type Facade = Record<string, (inv?: Record<string, unknown>) => Promise<any>>;

export default async (resolve: <T>(name: string) => T) => {
  const posts = resolve<Facade>('post');
  const published = await posts.list();
  if (published.length > 0) return [];

  const authors = await resolve<Facade>('author').list();
  const [alice, bob] = authors;

  const items = [
    { title: 'Introduction à Fougere', body: 'Fougere est un framework TypeScript basé sur une philosophie single-schema...', authorId: alice.id, publish: true },
    { title: 'Les Entity comme source de vérité', body: 'Dans Fougere, une Entity déclare ses champs via des helpers typés...', authorId: alice.id, publish: true },
    { title: 'Adapters : du schema au stockage', body: 'Les adapters transforment le schema en tables SQL, types GraphQL...', authorId: bob.id, publish: true },
    { title: 'Convention over configuration', body: 'Fougere scanne automatiquement les fronds pour découvrir entities et handlers.', authorId: bob.id, publish: true },
    { title: 'Le pattern Frond', body: 'Un frond est un hexagone métier autonome qui encapsule entities, handlers et policies.', authorId: alice.id, publish: false },
  ];

  for (const { publish, ...item } of items) {
    const created = await posts.create({ params: {}, query: {}, body: item, state: {} });
    if (publish) {
      await posts.publish({ params: { id: created.id }, query: {}, body: undefined, state: { user: { id: item.authorId } } });
    }
  }

  return [];
};
