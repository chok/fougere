/**
 * Deterministic dataset + ORM shared by the host process and the control app —
 * parity only means something if both sides serve the exact same data.
 */
export const PRODUCTS = [
  { id: 'p1', title: 'Fern', stock: 3 },
  { id: 'p2', title: 'Moss', stock: 0 },
];

export function createOrmFactory() {
  return () => ({
    async list() {
      return PRODUCTS.map((p) => ({ ...p }));
    },
    async findById(id) {
      const hit = PRODUCTS.find((p) => p.id === id);
      return hit ? { ...hit } : undefined;
    },
    async create(input) {
      return { id: 'created', ...input };
    },
    async update() { throw new Error('not exercised'); },
    async delete() { return false; },
    output() { return this; },
  });
}
