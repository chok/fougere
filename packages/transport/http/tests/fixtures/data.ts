/**
 * Deterministic dataset + storage shared by the host process and the control app —
 * parity only means something if both sides serve the exact same data.
 */
import type { Storage } from '@fougere/core';

export const PRODUCTS = [
  { id: 'p1', title: 'Fern', stock: 3 },
  { id: 'p2', title: 'Moss', stock: 0 },
];

export function createStorageFactory(): () => Storage {
  return () => ({
    async list() {
      return PRODUCTS.map((product) => ({ ...product }));
    },
    async findById(id: string) {
      const hit = PRODUCTS.find((product) => product.id === id);
      return hit ? { ...hit } : undefined;
    },
    async create(input: Record<string, unknown>) {
      return { id: 'created', ...input };
    },
    async update() { throw new Error('not exercised'); },
    async delete() { return false; },
    output() { return this; },
  }) as unknown as Storage;
}
