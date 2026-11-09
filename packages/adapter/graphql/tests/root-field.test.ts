import { describe, it, expect } from 'vitest';
import { rootFieldOf } from '../src/OperationsConfig.js';

describe('the root field of a list', () => {
  it.each([
    ['Post', 'posts'],
    ['Category', 'categories'],
    ['Day', 'days'],
    ['Person', 'people'],
    ['OrderItem', 'orderItems'],
  ])('%s → %s, the plural a table and a route use', (entity, field) => {
    expect(rootFieldOf('list', entity, {})).toBe(field);
  });
});
