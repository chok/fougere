import { Crud, FougereError, ErrorCode } from '@fougere/core';
import User from '../entities/User.js';

// An Output contract — a read projection of the entity, declared once.
export class UserCard extends User.pick('id', 'name', 'status') {}

// Crud(User) gives list/create/update/delete for free — the accelerator.
// 'deactivate' is the business contract: a state transition, not a field write.
export default class UserHandler extends Crud(User) {
  /** active→inactive — an operation, not a field write. Judge: active only. */
  async deactivate(id: string): Promise<User> {
    const user = await this.storage.findById(id);
    if (!user) {
      throw new FougereError({ code: ErrorCode.NOT_FOUND, message: `User '${id}' not found`, entity: 'user', operation: 'deactivate' });
    }
    if (user.status === 'inactive') {
      throw new FougereError({ code: ErrorCode.CONFLICT, message: 'Already inactive', entity: 'user', operation: 'deactivate' });
    }
    return this.storage.update(id, { status: 'inactive' });
  }

  /** Active users, projected to the card contract. */
  async active(): Promise<UserCard[]> {
    const users = await this.storage.list({ where: { status: 'active' } });
    return users.map(({ id, name, status }) => ({ id, name, status }));
  }
}
