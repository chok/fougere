import { Crud, FougereError, ErrorCode } from '@fougere/core';
import Task from '../entities/Task.js';

// An Output contract — a read projection of the entity, declared once.
export class TaskCard extends Task.pick('id', 'title', 'status') {}

// Crud(Task) gives list/create/update/delete for free — the accelerator.
// 'complete' is the business contract: a state transition, not a field write.
export default class TaskHandler extends Crud(Task) {
  /** open→done — an operation, not a field write. Judge: open only. */
  async complete(id: string): Promise<Task> {
    const task = await this.orm.findById(id);
    if (!task) {
      throw new FougereError({ code: ErrorCode.NOT_FOUND, message: `Task '${id}' not found`, entity: 'task', operation: 'complete' });
    }
    if (task.status === 'done') {
      throw new FougereError({ code: ErrorCode.CONFLICT, message: 'Already done', entity: 'task', operation: 'complete' });
    }
    return this.orm.update(id, { status: 'done' });
  }

  /** Still-open tasks, projected to the card contract. */
  async open(): Promise<TaskCard[]> {
    const tasks = await this.orm.list({ where: { status: 'open' } });
    return tasks.map(({ id, title, status }) => ({ id, title, status }));
  }
}
