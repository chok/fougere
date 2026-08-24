#!/usr/bin/env bash
#
# Point `latest` at a version already published under `--tag alpha`.
#
# `pnpm publish -r --tag alpha` never moves `latest`, so after a release the 15
# packages that existed before keep serving the previous version to a bare
# `npm i`, while the ones created by that release get `latest` set by npm on
# their first publish. This closes that gap in one pass.
#
# The version is read from each package's own manifest, so the script cannot
# promote a version that is not the one in the working tree.
#
#   ./scripts/promote-latest.sh          # dry run — prints what it would do
#   ./scripts/promote-latest.sh --apply
#
set -euo pipefail

APPLY=${1:-}
cd "$(dirname "$0")/.."

fail=0

for manifest in packages/*/package.json packages/*/*/package.json; do
  [ -f "$manifest" ] || continue

  read -r name version private < <(node -e "
    const p = require('./$manifest');
    console.log(p.name ?? '-', p.version ?? '-', p.private ? 'private' : 'public');
  ")

  [ "$private" = "public" ] || continue
  [ "$name" != "-" ] || continue

  current=$(pnpm view "$name" dist-tags.latest 2>/dev/null || true)

  if [ "$current" = "$version" ]; then
    printf '  %-26s latest déjà sur %s\n' "$name" "$version"
    continue
  fi

  if [ "$APPLY" = "--apply" ]; then
    if pnpm dist-tag add "$name@$version" latest >/dev/null 2>&1; then
      printf '  %-26s %s → %s\n' "$name" "${current:-aucun}" "$version"
    else
      printf '  %-26s ÉCHEC (publié en %s ?)\n' "$name" "$version"
      fail=1
    fi
  else
    printf '  %-26s %s → %s\n' "$name" "${current:-aucun}" "$version"
  fi
done

if [ "$APPLY" != "--apply" ]; then
  echo
  echo "Essai à blanc. Relancer avec --apply pour écrire."
fi

exit $fail
