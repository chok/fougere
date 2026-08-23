import Note from '../entities/Note.js';

declare class NoteRepository {
  findById(id: string): Promise<Note | undefined>;
}

/**
 * Two ops the scan cannot fully serve — the reason `frond.config.ts` can state a contract.
 *
 * `retitle` IS visible to the scan, which derives its binding (an object param → body),
 * but nothing tells it WHAT judges that body: the param type is a bare record, not an
 * entity. Config names the judge.
 */
export default class NoteHandler {
  constructor(private notes: NoteRepository) {}

  async retitle(input: Record<string, unknown>) {
    return { ...(await this.notes.findById('note-1')), title: input.title };
  }
}

/**
 * `archive` is assigned onto the prototype AFTER the class body, so the AST scan — which
 * reads class members from source — cannot see it. That is the shape of the open Known
 * issue: a method inherited from an *installed* base class is invisible the same way
 * (heritage resolution is workspace-only), and the op silently misses the façade.
 *
 * Nothing here is a trick for the test's sake: what matters is that the method exists at
 * RUNTIME and not in the parsed source, which is exactly the production case.
 */
Object.assign(NoteHandler.prototype, {
  async archive(this: { notes: NoteRepository }, id: string) {
    return { id, archived: true };
  },
});
