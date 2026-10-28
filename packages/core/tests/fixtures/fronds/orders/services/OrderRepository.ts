export default class OrderRepository {
  findAll() {
    return [{ id: '1', status: 'pending', total: 42 }];
  }
}
