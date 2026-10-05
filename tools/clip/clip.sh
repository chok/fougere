#!/usr/bin/env bash
# The gradient as a GIF: the starter `fougere new` writes, its blog frond in another process,
# the terminal and the page filmed by one browser so they share a clock.
# Needs ttyd and ffmpeg (`brew install ttyd ffmpeg`). Writes tools/clip/out/gradient.gif.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
OUT="$HERE/out"
WORK="$(mktemp -d)"
rm -rf "$OUT" && mkdir -p "$OUT"
release() { for port in 3100 4100 7681; do lsof -ti tcp:$port | xargs kill 2>/dev/null || true; done; }
trap 'release; rm -rf "$WORK"' EXIT
release

( cd "$WORK" && node "$ROOT/packages/cli/dist/src/bin.js" new shop --frond blog --app nuxt --local >/dev/null )
PROJECT="$WORK/shop"
sed -i '' "s|fronds: { '@fougere/log': {} }|fronds: { '@fougere/log': {}, blog: 'http://127.0.0.1:4100' }|" "$PROJECT/fougere.config.ts"
sed -i '' 's/devtools: { enabled: true }/devtools: { enabled: false }/' "$PROJECT/apps/nuxt/nuxt.config.ts"
( cd "$PROJECT" && pnpm install >/dev/null && pnpm migrate >/dev/null )

( cd "$PROJECT/apps/nuxt" && npx nuxt dev --port 3100 >"$OUT/nuxt.log" 2>&1 ) &
until curl -s -o /dev/null --max-time 20 http://localhost:3100/posts; do sleep 1; done

mkdir -p "$WORK/zdot" && cp "$HERE/zshrc" "$WORK/zdot/.zshrc"
CLIP_PROJECT="$PROJECT" ZDOTDIR="$WORK/zdot" ttyd -W -p 7681 -t fontSize=14 -t 'theme={"background":"#151c18"}' zsh >"$OUT/ttyd.log" 2>&1 &
until curl -s -o /dev/null http://localhost:7681; do sleep 0.2; done

OFFSET=$(node "$HERE/record.ts" "$OUT")
ffmpeg -y -loglevel error -i "$OUT"/720/*.webm -i "$OUT"/640/*.webm -filter_complex "
  [1:v]tpad=start_duration=${OFFSET}:start_mode=add:color=0x151c18[page];
  [0:v][page]hstack=shortest=1,fps=12,scale=1200:-1:flags=lanczos,split[a][b];
  [a]palettegen=stats_mode=diff[palette];[b][palette]paletteuse=dither=bayer:bayer_scale=4" "$OUT/gradient.gif"
echo "$OUT/gradient.gif"
