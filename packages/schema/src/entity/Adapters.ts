import { EntryJudge } from '../judge/EntryJudge.js';
import { Registry } from '../Registry.js';

class AdapterRegistry extends Registry<EntryJudge> {
  /**
   * Validates `{ sql: … }` with the judge `sql` registered. A name this process never
   * imported is skipped, not refused: here it looks exactly like a typo.
   * FR : valide `{ sql: … }` avec le juge qu'a enregistré `sql`. Un nom que ce process n'a
   * pas importé est ignoré, pas refusé : ici il ressemble exactement à une faute de frappe.
   * `Adapters.check({ sql: { body: { columnTpye: {} } } }, 'Post.adapters')`
   * → throws `Post.adapters.sql.body: Property "columnTpye" does not match …`
   */
  check(stated: Readonly<Record<string, unknown>> | undefined, at: string): void {
    if (!stated) return;

    for (const [name, entries] of Object.entries(stated)) {
      this.find(name)?.check(entries, `${at}.${name}`);
    }
  }
}

/**
 * Which adapters this process answers for, and what each accepts under a field name.
 * `EntityAdapterSet` owns the two levels an entry is addressed by; this owns the first.
 */
export const Adapters = new AdapterRegistry('adapter', 'import the adapter that answers it');
