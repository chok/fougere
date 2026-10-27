import { Line, type Answer } from '../../../door.js';
import type NoteHandler from '../handlers/NoteHandler.js';

/** Behind an alias — the reading holds, since it reads the fields. */
type Moved = Answer<301 | 308, { location: string }>;

export default class NoteGate extends Line<NoteHandler> {
  constructor(inner: Line<NoteHandler>) { super(inner); }

  async findById(request: unknown): Promise<Answer | Moved> {
    return this.inner!.answer(request);
  }

  async delete(request: unknown): Promise<Answer | Answer<423>> {
    return this.inner!.answer(request);
  }

  async list(request: unknown): Promise<Answer> {
    return this.inner!.answer(request);
  }
}
