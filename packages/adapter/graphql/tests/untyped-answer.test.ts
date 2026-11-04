import SchemaBuilder from '@pothos/core';
import { describe, expect, it } from 'vitest';
import { entity, primary, text } from '@fougere/schema';
import { registerOperations, registerType } from '../src/OperationsConfig.js';

class Post extends entity({ id: primary(), title: text() }) {}

const op = (name: string, returnType: Record<string, unknown>) =>
  [name, { kind: 'command', signature: { name, params: [], returnType: { raw: name, ...returnType } } }] as const;

const operations = new Map<string, any>([
  op('label', { name: 'string' }),
  op('labels', { name: 'string', array: true }),
  op('total', { name: 'number' }),
  op('touch', { name: 'void', undefined: true }),
  op('report', { name: '{ ok: boolean; }' }),
  op('reports', { name: '{ ok: boolean; }', array: true }),
]);

const facade = {
  label: async () => 'x',
  labels: async () => ['x', 'y'],
  total: async () => 2.5,
  touch: async () => undefined,
  report: async () => ({ ok: true }),
  reports: async () => [{ ok: true }],
};

function schema(withEntity: boolean) {
  const builder = new SchemaBuilder({});
  builder.queryType({ fields: (t: any) => ({ ok: t.boolean({ resolve: () => true }) }) });
  builder.mutationType({});
  const type = withEntity ? registerType(builder, { name: 'Post', entity: Post }) : undefined;
  registerOperations(builder, { name: 'ghost', facade, operations, ...(type && { type }) } as never);

  return builder.toSchema();
}

describe('an answer no schema states', () => {
  it('is served with the type it has, whether or not its handler has an entity', () => {
    for (const withEntity of [false, true]) {
      const fields = schema(withEntity).getMutationType()!.getFields();
      expect(Object.fromEntries(Object.values(fields).map((field) => [field.name, String(field.type)]))).toEqual({
        label: 'String!',
        labels: '[String!]!',
        total: 'Float!',
        touch: 'Boolean',
        report: 'String!',
        reports: '[String!]!',
      });
    }
  });

  it('answers the value, an object as its JSON', async () => {
    const fields = schema(false).getMutationType()!.getFields();
    const answerOf = (name: string) => fields[name]!.resolve!(undefined, {}, {}, {} as never);

    expect(await answerOf('label')).toBe('x');
    expect(await answerOf('labels')).toEqual(['x', 'y']);
    expect(await answerOf('total')).toBe(2.5);
    expect(await answerOf('report')).toBe('{"ok":true}');
    expect(await answerOf('reports')).toEqual(['{"ok":true}']);
    expect(await answerOf('touch') ?? null).toBeNull();
  });
});
