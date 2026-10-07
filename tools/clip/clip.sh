#!/usr/bin/env bash
# The gradient as a GIF: the terminal above, the page below, filmed by one browser so they share a clock.
# The starter `fougere new` writes, one line of config, and its blog frond in another process.
# Needs ttyd, tmux and ffmpeg (`brew install ttyd tmux ffmpeg`). Writes tools/clip/out/gradient.gif.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
OUT="$HERE/out"
WORK="$(mktemp -d)"
rm -rf "$OUT" && mkdir -p "$OUT"
release() {
  tmux -L clip kill-server 2>/dev/null || true
  for port in 3100 4100 7681; do lsof -ti tcp:$port | xargs kill 2>/dev/null || true; done
}
trap 'release; rm -rf "$WORK"' EXIT
release

( cd "$WORK" && node "$ROOT/packages/cli/dist/src/bin.js" new shop --frond blog --app nuxt --local >/dev/null )
PROJECT="$WORK/shop"
sed -i '' 's/devtools: { enabled: true }/devtools: { enabled: false }/' "$PROJECT/apps/nuxt/nuxt.config.ts"
( cd "$PROJECT" && pnpm install >/dev/null && pnpm migrate >/dev/null )

mkdir -p "$WORK/zdot" && cp "$HERE/zshrc" "$WORK/zdot/.zshrc"
CLIP_PROJECT="$PROJECT" ZDOTDIR="$WORK/zdot" PORT=3100 tmux -L clip -f "$HERE/tmux.conf" new-session -d -s clip -x 150 -y 20 zsh
tmux -L clip select-pane -T shop
( cd "$PROJECT/apps/nuxt" && PORT=3100 npx nuxt dev >"$OUT/warm.log" 2>&1 ) &
until curl -s -o /dev/null --max-time 20 http://localhost:3100/posts; do sleep 1; done
lsof -ti tcp:3100 | xargs kill

until ! lsof -ti tcp:3100 >/dev/null; do sleep 0.2; done
ttyd -W -p 7681 -t fontSize=13 -t 'theme={"background":"#151c18"}' tmux -L clip attach -t clip >"$OUT/ttyd.log" 2>&1 &
until curl -s -o /dev/null http://localhost:7681; do sleep 0.2; done

OFFSET=$(node "$HERE/record.ts" "$OUT")
ffmpeg -y -loglevel error -i "$OUT"/terminal/*.webm -i "$OUT"/page/*.webm -filter_complex "
  [1:v]tpad=start_duration=${OFFSET}:start_mode=add:color=0x151c18[page];
  [0:v][page]vstack=shortest=1,fps=12,split[a][b];
  [a]palettegen=stats_mode=diff[palette];[b][palette]paletteuse=dither=bayer:bayer_scale=4" "$OUT/gradient.gif"
echo "$OUT/gradient.gif"
