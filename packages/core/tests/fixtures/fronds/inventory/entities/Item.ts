/** Test entity for Crud inheritance tests. */
export default class Item {
  static getFields() {
    return {
      id: { __brand: 'fougere_field' as const, type: 'id', options: { primary: true }, nullable: false },
      name: { __brand: 'fougere_field' as const, type: 'text', options: {}, nullable: false },
      quantity: { __brand: 'fougere_field' as const, type: 'number', options: {}, nullable: false },
    };
  }
}
