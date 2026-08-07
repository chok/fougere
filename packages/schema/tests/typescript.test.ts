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
import { typeSourceOf, facadeTypeSourceOf } from '../src/projections/typescript.js';

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

describe('carte → type de façade', () => {
  const ops = [
    { name: 'list', cardinality: 'page' as const, description: 'Tous les posts.' },
    { name: 'findById', cardinality: 'maybe' as const },
    { name: 'create', cardinality: 'one' as const },
    { name: 'delete', cardinality: 'none' as const },
    { name: 'search', cardinality: 'many' as const },
  ];

  it('dit combien revient, pas seulement quelle forme', () => {
    const source = facadeTypeSourceOf(ops, { name: 'PostFacade', rowType: 'Post' });

    // Le piège que ce champ existe pour éviter : `list` ne rend PAS `Post[]`.
    // `ListResult<T> extends Array<T>` — un tableau qui porte ses totaux.
    expect(source).toContain('list(invocation?: Invocation): Promise<Post[] & { total?: number; endCursor?: string; hasMore?: boolean }>;');
    expect(source).toContain('findById(invocation?: Invocation): Promise<Post | undefined>;');
    expect(source).toContain('create(invocation?: Invocation): Promise<Post>;');
    expect(source).toContain('search(invocation?: Invocation): Promise<Post[]>;');
    // `none` = aucune forme publiée. `unknown` le dit ; `void` interdirait de lire
    // un booléen qui revient bel et bien.
    expect(source).toContain('delete(invocation?: Invocation): Promise<unknown>;');
  });

  it('porte la phrase de doc de l\'opération', () => {
    expect(facadeTypeSourceOf(ops, { rowType: 'Post' })).toContain('/** Tous les posts. */');
  });

  it('sans cardinalité, ne devine pas', () => {
    // Une carte muette doit produire `unknown`, pas une supposition qui compile.
    expect(facadeTypeSourceOf([{ name: 'weekly' }], { rowType: 'Post' }))
      .toContain('weekly(invocation?: Invocation): Promise<unknown>;');
  });
});
