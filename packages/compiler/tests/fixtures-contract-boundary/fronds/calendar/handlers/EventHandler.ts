import { bool, date, entity, text, writeOnly } from '@fougere/schema';
import Event from '../entities/Event.js';

export class ScheduleInput extends entity({
  when: date(),
}) {}

export class ScheduleOutput extends entity({
  when: date(),
  decoded: bool(),
  secret: writeOnly(text()),
}) {}

export default class EventHandler {
  async schedule(input: ScheduleInput): Promise<ScheduleOutput> {
    return new ScheduleOutput({
      when: input.when,
      decoded: input.when instanceof Date,
      secret: 'server-only',
    });
  }

  async passthrough(_event: Event): Promise<Event> {
    return new Event({ id: 'event-1', title: 'Calendar' });
  }
}
