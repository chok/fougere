/**
 * An ADAPTER that asks — and the door it takes to do it.
 *
 * A storage is not user code: no scan reads it, no container resolves it, and it has no
 * app to ask through. An `Extension` does — `up(app)` receives one, so the adapter is
 * handed the same `canBookAsk` a frond would inject.
 *
 * What it asks is the same subject the handler asks, answered by the same responders,
 * wherever they run. The adapter names none of them either.
 */
import type { App, Extension, StorageFactory } from '@fougere/core';
import type CanBook from '../fronds/booking/entities/CanBook.js';

type Asking = (question: { room: string }) => Promise<CanBook[]>;

/** Rows in a Map, and one question before each write. */
export function asking(): { extension: Extension; storageFactory: StorageFactory } {
  let ask: Asking | undefined;
  const rows = new Map<string, Record<string, unknown>>();

  const storageFactory = (() => ({
    async list() { return [...rows.values()]; },
    async findById(id: string) { return rows.get(id); },
    async create(input: Record<string, unknown>) {
      // The adapter's own refusal, and it holds no list of who may object.
      const answers = await ask?.({ room: String(input.room) }) ?? [];
      console.log(`      the storage asked too — ${answers.length} answered`);
      const objecting = answers.filter((one) => !one.ok);
      if (objecting.length > 0) {
        throw new Error(`the storage refuses ${input.room}: ${objecting.map((one) => one.from).join(', ')}`);
      }

      const row = { ...input, id: input.id ?? `b${rows.size + 1}` };
      rows.set(String(row.id), row);

      return row;
    },
    async update() { throw new Error('not exercised'); },
    async delete() { return false; },
    output() { return this; },
  })) as unknown as StorageFactory;

  return {
    storageFactory,
    extension: {
      name: 'asking-storage',
      // The only moment an adapter can be handed a door: the app exists, and every
      // question it will put has been registered.
      up(app: App) { ask = app.container.resolve<Asking>('canBookAsk'); },
    },
  };
}
