import { Collect } from '@fougere/core';
import User from '../entities/User.js';

export default class CurrentUserCollector extends Collect<User> {
  async collect(): Promise<User> {
    return new User({ id: 'u-1', role: 'author' });
  }
}
