import SchemaBuilder from '@pothos/core';
import { describe, expect, it } from 'vitest';
import { entity, oneOf, primary, text, readOnly } from '@fougere/schema';
import { registerType, registerInput } from '../src/pothos.js';

/**
 * A bounded set IS a type.
 *
 * `oneOf('draft','published')` fed the form's `select` and the DDL's `CHECK` from the day it
 * was written; GraphQL alone fell through to `String`. So a schema explorer showed nothing of
 * the set, a generated client could not narrow the union, and only the runtime judge refused
 * a value outside it.
 */
class Post extends entity({
  id: primary(),
  title: text({ min: 1 }),
  // Server-owned: never accepted from a client, so it reaches the INPUT side through nothing.
  status: readOnly(oneOf('draft', 'published', { default: 'draft' })),
  // Client-writable, which is what makes it the one that proves input and output share a type.
  visibility: oneOf('public', 'private', { default: 'public' }),
}) {}

/** Values a GraphQL enum cannot spell — an identifier, never an arbitrary string. */
class Task extends entity({
  id: primary(),
  phase: oneOf('in-progress', 'done'),
}) {}

function typeMapOf(register: (builder: any) => void) {
  const builder = new SchemaBuilder({});
  builder.queryType({ fields: (t: any) => ({ ok: t.boolean({ resolve: () => true }) }) });
  register(builder);
  return builder.toSchema().getTypeMap();
}

/**
 * `instanceof GraphQLEnumType` is not available to us: `graphql` resolves as both ESM and CJS
 * in this workspace, so a type built through one copy fails the check from the other. What the
 * type IS shows in what it answers.
 */
function enumValueNames(type: unknown): string[] | undefined {
  const t = type as { getValues?: () => { name: string }[] } | undefined;
  return typeof t?.getValues === 'function' ? t.getValues().map((v) => v.name) : undefined;
}

describe('a bounded set becomes a GraphQL enum', () => {
  it('names the enum after the entity and carries its values', () => {
    const types = typeMapOf((b) => registerType(b, { name: 'Post', entity: Post }));

    expect(enumValueNames(types.PostStatus)).toEqual(['draft', 'published']);
    expect((types.Post as any).getFields().status.type.toString()).toBe('PostStatus');
  });

  /**
   * The input side is the same type, not a twin: a client must be able to hand back the
   * value a query just gave it, and a `String` input would refuse nothing.
   */
  it('shares one enum between the type and an input derived from it', () => {
    const types = typeMapOf((b) => {
      registerType(b, { name: 'Post', entity: Post });
      registerInput(b, { name: 'CreatePostInput', schema: Post.pick('title', 'visibility') });
    });

    expect(Object.keys(types).filter((n) => n.startsWith('PostVisibility'))).toEqual(['PostVisibility']);
    expect((types.CreatePostInput as any).getFields().visibility.type.toString()).toBe('PostVisibility');
    expect((types.Post as any).getFields().visibility.type.toString()).toBe('PostVisibility');
  });

  /**
   * `oneOf` is a JSON Schema keyword and accepts any string; a GraphQL enum value is an
   * identifier. A set that will not fit stays a String — the judge still refuses what is
   * not in it, so nothing is lost but the type.
   */
  it('leaves a set GraphQL cannot spell as a String', () => {
    const types = typeMapOf((b) => registerType(b, { name: 'Task', entity: Task }));

    expect(types.TaskPhase).toBeUndefined();
    expect((types.Task as any).getFields().phase.type.toString()).toBe('String');
  });
});
