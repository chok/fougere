const published = { status: 'published', publishedAt: new Date() };

export default [
  { title: 'Introduction à Fougere', body: 'Fougere est un framework TypeScript basé sur une philosophie single-schema...', authorId: 'alice', ...published },
  { title: 'Les Entity comme source de vérité', body: 'Dans Fougere, une Entity déclare ses champs via des helpers typés...', authorId: 'alice', ...published },
  { title: 'Adapters : du schema au stockage', body: 'Les adapters transforment le schema en tables SQL, types GraphQL...', authorId: 'bob', ...published },
  { title: 'Convention over configuration', body: 'Fougere scanne automatiquement les fronds pour découvrir entities et handlers.', authorId: 'bob', ...published },
  { title: 'Le pattern Frond', body: 'Un frond est un hexagone métier autonome qui encapsule entities, handlers et policies.', authorId: 'alice' },
]
