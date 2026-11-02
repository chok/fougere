// Rewrites every link to a docs page that moved, from site/apps/web/redirects.json — the same table the
// site's redirects are built from. A section that moved to a page of its own is the one case a
// server redirect cannot reach (the anchor never leaves the browser), which is why it lives here.
//
//   node site/scripts/relink-docs.mjs          rewrite in place
//   node site/scripts/relink-docs.mjs --check  list what would change, exit 1 if anything would
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const repository = join(import.meta.dirname, '..', '..');
const { pages, sections } = JSON.parse(readFileSync(join(repository, 'site', 'apps', 'web', 'redirects.json'), 'utf8'));
const check = process.argv.includes('--check');

const LINK = /(?<=[(\s'"`]|fougere\.dev)(\/docs(?:\/[a-z0-9-]+)*)(#[a-z0-9-]*)?(?![a-z0-9/-])/g;

const moved = (path, anchor = '') => {
  const section = Object.entries(sections).find(([from]) => {
    const [page, prefix] = from.split('#');

    return page === path && anchor.slice(1).startsWith(prefix);
  });
  if (section) return section[1];
  if (pages[path] !== undefined) return pages[path] + anchor;

  return undefined;
};

const tracked = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { cwd: repository, encoding: 'utf8' })
  .split('\n')
  .filter((file) => /\.(md|ts|tsx|vue|mjs|js|svelte)$/.test(file) && !file.includes('node_modules'));

let changed = 0;
for (const file of tracked) {
  const path = join(repository, file);
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    continue;
  }
  const next = text.replace(LINK, (whole, page, anchor) => moved(page, anchor ?? '') ?? whole);
  if (next === text) continue;
  changed++;
  if (check) console.log(file);
  else writeFileSync(path, next);
}

console.log(`${changed} file(s) ${check ? 'would change' : 'relinked'}`);
if (check && changed > 0) process.exit(1);
