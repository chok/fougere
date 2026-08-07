/**
 * La carte porte de quoi typer, et personne ne le lisait.
 *
 * `reconstruct` rend un `SchemaConstructor<Fields>` — un générique. Une entité
 * synchronisée depuis un hôte distant valide donc parfaitement à l'exécution et
 * n'apprend rien au compilateur. Ce test dit ce que la troisième lecture produit.
 */
import { describe, it, expect } from 'vitest';
import { entity, primary, text, number, bool, date, oneOf, list, optional, nullable, ref, many } from '../src/index.js';
import { describe as describeSchema } from '../src/index.js';
import { typeSourceOf } from '../src/projections/typescript.js';

class Author extends entity({ id: primary(), name: text() }) {}

class Post extends entity({
  id: primary(),
  title: text({ min: 1, max: 160 }),
  views: number(),
  draft: bool(),
  status: oneOf('draft', 'published', { default: 'draft' }),
  publishedAt: optional(date()),
  editedAt: nullable(date()),
  tags: list(text()),
  authorId: ref(Author),
  comments: many(Author),
}) {}

const source = typeSourceOf(describeSchema(Post, 'post'));

describe('carte → type TypeScript', () => {
  it('rend chaque champ dans la forme que le consommateur reçoit', () => {
    expect(source).toBe([
      'export interface Post {',
      '  id: string;',
      '  title: string;',
      '  views: number;',
      '  draft: boolean;',
      // Un jeu de valeurs borné EST un type : l'énumération voyage, l'union aussi.
      "  status: \"draft\" | \"published\";",
      // `date-time` est la forme du fil ; le boundary la décode, donc le type dit Date.
      '  publishedAt: Date | null;',
      '  editedAt: Date | null;',
      '  tags: string[];',
      '  authorId: string;',
      // Une relation `many` n'a pas d'items — ce sont les ids de l'autre côté.
      '  comments: string[];',
      '}',
    ].join('\n'));
  });

  it('type la LECTURE, pas la création', () => {
    // `required` sur une carte répond « ce qu'un appelant doit fournir à la création ».
    // `id` en est absent (il est généré) et il est pourtant toujours là sur une ligne.
    // Typer la lecture depuis la règle de création rendrait `post.id` peut-être absent.
    const card = describeSchema(Post, 'post');
    expect(card.required).not.toContain('id');
    expect(source).toContain('  id: string;');
  });

  it('nomme l\'interface d\'après la carte, ou d\'après ce qu\'on lui dit', () => {
    expect(typeSourceOf(describeSchema(Author, 'author'))).toContain('interface Author {');
    expect(typeSourceOf(describeSchema(Author, 'author'), { name: 'AuthorCard' })).toContain('interface AuthorCard {');
    expect(typeSourceOf(describeSchema(Author, 'author'), { exported: false })).toMatch(/^interface /);
  });
});
