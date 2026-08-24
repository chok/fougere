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


def resolve(cited: str) -> str | None:
    for prefix in PREFIXES:
        candidate = REPO / (prefix + cited)
        if candidate.is_file():
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


def last_touched(path: str) -> str | None:
    done = subprocess.run(['git', '-C', str(REPO), 'log', '-1', '--format=%cs %h', '--', path],
                          capture_output=True, text=True)
    return done.stdout.strip() or None


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
        # A bare `.d.ts` is prose, not a citation — the heritage entry talks about it as a
        # kind of file.
        cited = sorted({c for c in re.findall(r'`([\w@./+-]+\.ts)`', entry)
                        if not c.startswith('.')})
        stamps, missing = [], []
        for citation in cited:
            path = resolve(citation)
            if not path:
                # Only report what LOOKS like a path in this repo. A bare name such as
                # `frond.config.ts` is a user-project convention, cited as a remedy: it has
                # no file here and never will.
                if '/' in citation:
                    missing.append(citation)
                continue
            stamp = last_touched(path)
            if stamp:
                stamps.append(stamp)
        stamps.sort(reverse=True)
        rows.append((stamps[0] if stamps else '0000-00-00 —', title, len(cited), missing))

    rows.sort(reverse=True)
    shown = [row for row in rows if not floor or row[0] >= floor]
    print(f"{'LAST COMMIT':21} {'CITED':5} ENTRY")
    for stamp, title, count, missing in shown:
        # A citation that does not resolve is flagged: the file was renamed or removed, which
        # is itself a reason to re-read the entry.
        mark = '  ⚠ not found: ' + ', '.join(missing) if missing else ''
        print(f"{stamp:21} {count:<5} {title}{mark}")
    if floor:
        print(f"\n{len(shown)} of {len(rows)} — the rest cite code older than {args.since} days.")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
