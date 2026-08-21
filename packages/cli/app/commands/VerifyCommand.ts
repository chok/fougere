import type { VerifyResult, RemoteVerdict } from '../../fronds/scaffold/handlers/VerifyHandler.js';
import type { App } from '@fougere/core';
import { createAppRunner, breachMessage } from '@fougere/core';
import type { ui as createUi } from '../../src/ui.js';
import pc from 'picocolors';

type Ui = ReturnType<typeof createUi>;

export default class VerifyCommand {
  constructor(private app: App, private ui: Ui) {}

  async run(raw: Record<string, unknown>) {
    // Ride the call contract — the same envelope every consumer uses.
    const result = await createAppRunner(this.app)(
      { entity: 'verify', op: 'execute' },
      { params: {}, query: {}, body: raw, state: {} },
    ) as VerifyResult;

    if (result.empty) {
      this.ui.warn('Nothing accepted yet — run `fougere sync <name> --from <url>` first.');
      return;
    }

    let breaking = 0;
    let unreachable = 0;
    for (const remote of result.remotes) {
      if (remote.unreachable) unreachable += 1;
      breaking += remote.answer?.breaking.length ?? 0;
      this.ui.note(render(remote), `${remote.name} — ${remote.from}`);
    }

    if (breaking > 0) {
      this.ui.error(`${breaking} breaking change(s). Re-sync and fix, or hold the deploy.`);
    } else if (unreachable > 0) {
      this.ui.warn(`${unreachable} host(s) could not be reached — nothing concluded about them.`);
    } else {
      this.ui.success('Every accepted contract still holds.');
    }

    // A non-zero exit is what makes this a gate. An unreachable host does not fail:
    // an outage is not a broken contract, and a check that cries wolf stops being read.
    if (breaking > 0) process.exitCode = 1;
  }
}

function render(remote: RemoteVerdict): string {
  if (remote.unreachable) return `  ${pc.yellow('⚠')} unreachable — ${remote.unreachable}`;

  const answer = remote.answer!;
  const lines: string[] = [];
  for (const breach of answer.breaking) lines.push(`  ${pc.red('✗')} ${breachMessage(breach)}`);
  for (const pair of answer.ambiguous) {
    lines.push(`    ${pc.dim(`${pair.door}: ${pair.removed} → ${pair.added}? a re-sync may be all it takes`)}`);
  }
  if (answer.breaking.length === 0) lines.push(`  ${pc.green('✓')} holds`);
  if (answer.additive.length > 0) {
    lines.push(`  ${pc.dim(`${answer.additive.length} addition(s) — re-sync to use them`)}`);
  }
  return lines.join('\n');
}
