export default class OrderRepository {
  private orders = [
    { id: '1', customerId: 'c1', status: 'pending', total: 59.90 },
    { id: '2', customerId: 'c2', status: 'paid', total: 120.00 },
  ];

  findAll() {
    return this.orders;
  }

  findById(id: string) {
    return this.orders.find((o) => o.id === id) ?? null;
  }
}
