/** `session` — a caller's state kept in a row, the caller holding only a reference to it. Registered at import. */
import '@fougere/state-cookie';
import { frond, States, type StorageFor } from '@fougere/core';
import { Format, type Accepted } from '@fougere/schema';
import StateSession from './StateSession.js';

export { default as StateSession } from './StateSession.js';

/** What `state: { cart: { session: {} } }` may say — nothing yet: every name shares one row. */
const SESSION = Format.of('state/session').closed();

export type SessionOptions = Accepted<typeof SESSION>;

declare module '@fougere/core' {
  interface FougereStates {
    session: SessionOptions;
  }
}

/** The cookie the reference travels in. */
const REFERENCE = 'session';

/** A request's row, read once and found again when the request writes. */
const held = new WeakMap<object, StateSession | undefined>();

const cookie = () => States.resolve('cookie');

function rowsIn(storageFor: StorageFor) {
  const rows = storageFor('stateSession');
  if (!rows) throw new Error('StateSession has no storage here — the session frond was not brought into this app.');

  return rows;
}

/** 256 random bits: what nobody guesses needs no signature. */
function referenceOf(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32));

  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

States.register('session', {
  over: 'http',
  format: SESSION,
  fronds: [frond('session', { entities: [StateSession] })],
  read: async (carrier, names, storageFor) => {
    const reference = (await cookie().read(carrier, [{ name: REFERENCE, options: {} }], storageFor)).get(REFERENCE);
    const row = reference === undefined ? undefined : await rowsIn(storageFor).findById(reference) as StateSession | undefined;
    held.set(carrier as object, row);

    return new Map(names.flatMap(({ name }) => (row?.values[name] === undefined ? [] : [[name, row.values[name]!] as const])));
  },
  write: async (carrier, written, storageFor) => {
    const row = held.get(carrier as object);
    const values = { ...row?.values };
    for (const { name, token } of written) {
      if (token === undefined) delete values[name];
      else values[name] = token;
    }
    const rows = rowsIn(storageFor);

    if (Object.keys(values).length === 0) {
      if (!row) return;
      await rows.delete(row.id);
      await cookie().write(carrier, [{ name: REFERENCE, token: undefined, options: {} }], storageFor);

      return;
    }
    const id = row?.id ?? referenceOf();
    await rows.upsert({ id, values });
    if (!row) await cookie().write(carrier, [{ name: REFERENCE, token: id, options: {} }], storageFor);
  },
});
