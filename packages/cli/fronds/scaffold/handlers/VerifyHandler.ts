import { compare, type Compatibility, type IdentityCard } from '@fougere/core';
import RemoteCard from '../services/RemoteCard.js';
import ContractLock from '../services/ContractLock.js';

/** One remote, and whether what it serves still honours what was accepted. */
export interface RemoteVerdict {
  name: string;
  /** Where the question was asked — the lock's address unless `--from` overrode it. */
  from: string;
  /** Absent when the host could not be reached: unreachable is not incompatible. */
  answer?: Compatibility;
  /** Why nothing could be concluded. */
  unreachable?: string;
}

export interface VerifyResult {
  /** Nothing was ever accepted — the lock is missing or empty. */
  empty: boolean;
  remotes: RemoteVerdict[];
}

/**
 * Does what each host serves still honour what this consumer accepted?
 *
 * The accepted side is `fougere.lock.json`, written by `sync` and committed. The served
 * side is asked of the host, now. Nothing is published anywhere and no deployment is
 * recorded: the state a broker keeps a copy of is read from the thing that has it.
 *
 * It answers about the host it is POINTED AT, which is what makes it a pre-deploy gate —
 * run it against staging before promoting, against production before shipping a consumer.
 */
export default class VerifyHandler {
  private cwd = process.cwd();

  constructor(
    private remote: RemoteCard,
    private lock: ContractLock,
  ) {}

  /** Check the accepted contracts against what each host serves right now. */
  async execute(input: { name?: string; from?: string }): Promise<VerifyResult> {
    const lock = this.lock.read(this.cwd);
    const names = input.name ? [input.name] : Object.keys(lock.remotes);

    if (names.length === 0) return { empty: true, remotes: [] };
    if (input.name && !(input.name in lock.remotes)) {
      throw new Error(`No remote '${input.name}' in ${this.lock.filename}. Run \`fougere sync ${input.name} --from <url>\` first.`);
    }

    const remotes: RemoteVerdict[] = [];
    for (const name of names) {
      const entry = lock.remotes[name]!;
      const from = input.from ?? entry.from;
      let card: IdentityCard;
      try {
        ({ card } = await this.remote.fetch(from));
      } catch (err) {
        // Unreachable is not incompatible, and reporting it as a breach would make an
        // outage look like a broken contract. Said, and left to the caller to weigh.
        remotes.push({ name, from, unreachable: err instanceof Error ? err.message : String(err) });
        continue;
      }
      remotes.push({ name, from, answer: compare(entry.frond, card.fronds.find((f) => f.name === name)) });
    }

    return { empty: false, remotes };
  }
}
