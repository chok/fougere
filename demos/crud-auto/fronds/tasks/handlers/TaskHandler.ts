import { Crud } from '@fougere/core';
import Task from '../entities/Task.js';

export class ToggleInput extends Task.pick('id') {}
export class ToggleOutput extends Task.pick('id', 'title', 'done') {}

export default class TaskHandler extends Crud(Task) {
  async toggle(input: ToggleInput): Promise<ToggleOutput | undefined> {
    const task = await super.findById(input.id);
    if (!task) return undefined;

    return super.update(input.id, { done: !task.done });
  }
}
