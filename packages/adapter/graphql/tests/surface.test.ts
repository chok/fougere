import { describe, it, expect } from 'vitest';
import { graphqlSurfaceOf } from '../src/answer.js';

describe('the audience a GraphQL path selects', () => {
  it('is the one segment after where GraphQL is mounted, on every host', () => {
    expect(graphqlSurfaceOf('/graphql')).toBeUndefined();
    expect(graphqlSurfaceOf('/graphql/public')).toBe('public');
    expect(graphqlSurfaceOf('/graphql/public?x=1')).toBe('public');
    expect(graphqlSurfaceOf('/api/graphql/admin', '/api/graphql')).toBe('admin');
    expect(graphqlSurfaceOf('/graphqlx/public')).toBeUndefined();
    expect(graphqlSurfaceOf('/graphql/a/b')).toBeUndefined();
  });
});
