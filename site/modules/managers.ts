import { extname } from 'node:path';
import { defineNuxtModule } from 'nuxt/kit';
import { PackageManager } from '@fougere/cli/package-manager';

/**
 * A command block written once, in npm, and marked `pm` — ```` ```bash pm ```` — read as a code group with
 * one tab per package manager, every group sharing the reader's choice (`sync="pm"`). The other tools'
 * lines come from the table `fougere new` writes a project with, so a page cannot say a command the
 * project would not answer. The Markdown stays one npm block, readable where no tab is drawn.
 */
export default defineNuxtModule({
  meta: { name: 'package-managers' },
  setup(_, nuxt) {
    nuxt.hook('content:file:beforeParse', ({ file }) => {
      // Read the way Content reads it: `extension` is optional, and `extname` keeps the dot.
      if ((file.extension ?? extname(file.id)).replace(/^\./, '') === 'md') file.body = withManagers(file.body);
    });
  },
});

const FENCE = /^```(\w+) pm\n([\s\S]*?)^```$/gm;

/** Every `pm` block of a page, as its code group. */
export function withManagers(markdown: string): string {
  return markdown.replace(FENCE, (_, language: string, body: string) => {
    const lines = body.replace(/\n$/, '').split('\n');
    const blocks = PackageManager.names.map((name) => {
      const said = lines.map((line) => saidBy(line, new PackageManager(name)));

      return ['```' + `${language} [${name}]`, ...aligned(said), '```'].join('\n');
    });

    return ['::code-group{sync="pm" class="managers"}', ...blocks, '::'].join('\n');
  });
}

/** One npm line in another tool's words, its comment set aside. A line that is not npm's keeps its own. */
function saidBy(line: string, manager: PackageManager): [string, string] {
  const [, command = '', comment = ''] = line.match(/^(.*?)(?:\s+(#.*))?$/) ?? [];
  const forms: [RegExp, (...parts: string[]) => string][] = [
    [/^npm install$/, () => manager.install()],
    [/^npm install (?:-D|--save-dev) (.+)$/, (packages) => manager.add(packages, true)],
    [/^npm install (.+)$/, (packages) => manager.add(packages)],
    [/^npm run (\S+)(.*)$/, (script, rest) => manager.script(script) + rest],
    [/^npm test(.*)$/, (rest) => manager.script('test') + rest],
    [/^npx (?:-y )?(.+)$/, (command) => manager.x(command)],
    [/^npm create (.+)$/, (entry) => manager.create(entry)],
  ];
  for (const [form, say] of forms) {
    const parts = command.match(form);
    if (parts) return [say(...parts.slice(1)), comment];
  }

  return [command, comment];
}

/** The comments of a block in one column, wherever the longest command now ends. */
function aligned(lines: [string, string][]): string[] {
  const column = Math.max(0, ...lines.filter(([, comment]) => comment).map(([command]) => command.length)) + 3;

  return lines.map(([command, comment]) => (comment ? command.padEnd(column) + comment : command));
}
