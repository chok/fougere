import { Crud } from '@fougere/core';
import Task from '../entities/Task.js';

export class ToggleInput extends Task.pick('id') {}
export class ToggleOutput extends Task.pick('id', 'title', 'done') {}

export default class TaskHandler extends Crud(Task) {
  async toggle(input: ToggleInput): Promise<ToggleOutput | undefined> {
    const task = await this.orm.findById(input.id);
    if (!task) return undefined;
    const updated = await this.orm.update(input.id, { done: !task.done });
    return { id: String(updated.id), title: String(updated.title), done: Boolean(updated.done) };
  }
}
