#!/usr/bin/env python3
"""Order the `## Known issues` entries by the RECENCY of the code they cite.

Measured 2026-08-24 over 31 entries: 6 were false or half false, and all six cited code
touched in the last seven days. Nothing older than 13 August was wrong. An entry is written
on the day of the fix and is then read by nobody — so the useful order is not how old the
entry looks, it is the last commit on what it describes.

This script judges nothing. It says where to start.

  python3 scripts/stale-notes.py            # all of them, freshest first
  python3 scripts/stale-notes.py --since 7  # only code touched in the last 7 days
"""
import argparse
import pathlib
import re
import subprocess
from datetime import date, timedelta

REPO = pathlib.Path(__file__).resolve().parent.parent
# A citation is a file path; the entries write them relative to `packages/`, to
# `packages/core/src/`, or from the root. Tried in that order.
PREFIXES = ('', 'packages/', 'packages/core/src/', 'packages/core/')
# What a citation of a FILE ends in, used only to decide whether a dead one is worth
# reporting. A directory citation that stops resolving is a rename, and `git log` on a
# path that no longer exists answers nothing — so it falls off the top of the list by
# itself, which is the signal.
EXTENSIONS = ('.ts', '.py', '.json', '.md', '.yaml', '.yml', '.vue', '.sql')
# What moves for a reason that has nothing to do with the entry being true. A release
# touches every package.json, and a docs pass touches every README — either one lifts every
# entry citing a DIRECTORY to the top of the list at once, which is the whole answer being
# wrong, not a rounding error. Measured 2026-08-28: 573f567 is eighteen READMEs and no
# TypeScript, and it had put two entries first.
NOT_THE_CODE = (
    ':(exclude)**/package.json', ':(exclude)package.json', ':(exclude)pnpm-lock.yaml',
    ':(exclude)**/README.md', ':(exclude)**/CHANGELOG.md',
)


def resolve(cited: str) -> str | None:
    # Three entries cite `site/content/` — always for the DOC half ("documented at…",
    # "nothing there documents `expose`"), never for the code they describe. That tree moves
    # on every translation pass, so ranking by it puts an entry at the top for a reason that
    # has nothing to do with whether it is still true.
    if cited.startswith('site/content'):
        return None
    for prefix in PREFIXES:
        candidate = REPO / (prefix + cited)
        # A directory answers `git log` as readily as a file, and nine entries cite one
        # (`packages/decorators`, `demos/sse-live`, `adapter/rest`). Ranking those by
        # whichever `.ts` they happened to also mention is what this line removes.
        if candidate.is_file() or candidate.is_dir():
            return str(candidate.relative_to(REPO))
    # An entry cites `hono.ts` as readily as `core/src/boot/egress.ts`: the first is relative
    # to the package the entry is about, and only a glob finds it. First hit wins — two files
    # of the same name in two packages would make the order arbitrary, and no entry cites one
    # today.
    for pattern in (f'packages/*/src/{cited}', f'packages/*/*/src/{cited}',
                    f'packages/*/{cited}', f'packages/*/*/{cited}'):
        for hit in sorted(REPO.glob(pattern)):
            if hit.is_file():
                return str(hit.relative_to(REPO))
    return None


def last_touched(path: str) -> tuple[str, str] | None:
    # Sorted on the full timestamp, shown on the day: two commits of the same afternoon are
    # ordered by WHEN, and ordering them by hash put a fix below the commit it followed.
    done = subprocess.run(['git', '-C', str(REPO), 'log', '-1', '--format=%cI %cs %h',
                           '--', path, *NOT_THE_CODE], capture_output=True, text=True)
    if not done.stdout.strip():
        return None
    stamp, day, sha = done.stdout.split()
    return stamp, f'{day} {sha}'


def entries() -> list[str]:
    text = (REPO / 'CLAUDE.md').read_text()
    if '## Known issues' not in text:
        raise SystemExit('CLAUDE.md has no `## Known issues` section')
    return re.findall(r'^- (.+?)(?=\n- |\Z)', text.split('## Known issues', 1)[1], re.S | re.M)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--since', type=int, metavar='DAYS',
                        help='show only entries whose code moved in the last N days')
    args = parser.parse_args()
    floor = (date.today() - timedelta(days=args.since)).isoformat() if args.since else None

    rows = []
    for entry in entries():
        title = re.sub(r'\*\*', '', entry.split('.')[0])[:64].replace('\n', ' ')
        # A citation is a backticked token that NAMES SOMETHING IN THIS REPO — not one
        # that ends in `.ts`. The extension rule made the probe blind to `site/Dockerfile`,
        # so the entry describing a broken production image was ranked by an unrelated
        # scanner file, and it stayed on the list for a day after the fix landed. What does
        # not resolve is dropped below, which is what keeps `Judge.row` and `Promise.all`
        # out without naming them.
        # A path carries a separator or an extension. A bare word carries neither, and the
        # entry that says "six sites in `src`" made the probe rank a whole package by it.
        cited = sorted({c for c in re.findall(r'`([\w@./+-]+)`', entry)
                        if not c.startswith(('.', '/'))
                        and ('/' in c or c.endswith(EXTENSIONS))})
        stamps, missing, resolved = [], [], 0
        for citation in cited:
            path = resolve(citation)
            if not path:
                # Only report what LOOKS like a path in this repo, and only for a spelling
                # a file would use: `Judge.row` and `demos/rust-frond` both carry a
                # separator, and only the second is a claim about the tree.
                if '/' in citation and citation.endswith(EXTENSIONS):
                    missing.append(citation)
                continue
            resolved += 1
            touched = last_touched(path)
            if touched:
                stamps.append(touched)
        stamps.sort(reverse=True)
        # CITED counts what RESOLVED, never the candidates: widening the pattern to any
        # backticked token made `Judge.row` and `Promise.all` candidates, and counting those
        # turned the column into noise (22 for an entry naming four files).
        top = stamps[0] if stamps else ('0000', '0000-00-00 —')
        rows.append((top[0], top[1], title, resolved, missing))

    rows.sort(reverse=True)
    shown = [row for row in rows if not floor or row[1] >= floor]
    print(f"{'LAST COMMIT':21} {'CITED':5} ENTRY")
    for _, shown_stamp, title, count, missing in shown:
        # A citation that does not resolve is flagged: the file was renamed or removed, which
        # is itself a reason to re-read the entry.
        mark = '  ⚠ not found: ' + ', '.join(missing) if missing else ''
        print(f"{shown_stamp:21} {count:<5} {title}{mark}")
    if floor:
        print(f"\n{len(shown)} of {len(rows)} — the rest cite code older than {args.since} days.")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
