import Observed from '../entities/Observed.js';
import PublishInput from '../entities/PublishInput.js';
import type User from '../entities/User.js';

export default class ObservedHandler {
  async getBaseline(): Promise<Observed> {
    return new Observed({ title: 'Baseline', role: 'author' });
  }

  async publish(input: PublishInput, user?: User): Promise<Observed> {
    return new Observed({ title: input.title, role: user?.role ?? 'missing' });
  }
}
