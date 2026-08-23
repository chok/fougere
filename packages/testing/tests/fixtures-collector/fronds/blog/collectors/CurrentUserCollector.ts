import { Collector } from '@fougere/core';
import User from '../entities/User.js';

export default class CurrentUserCollector extends Collector(User) {
  async collect(): Promise<User> {
    return new User({ id: 'u-1', role: 'author' });
  }
}
