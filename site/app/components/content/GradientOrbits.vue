<script setup lang="ts">
/**
 * The gradient as four small multiples. Two nodes in every cell — your page, the Frond —
 * and ONLY the link between them changes: a direct call, then a hop, then a hop across a
 * repository boundary, then one where the Frond is not TypeScript at all.
 *
 * Drawing it as rings was wrong and was thrown away: concentric arcs read as a radar, and
 * they made the Frond move, when the claim is that nothing moves except the wire.
 *
 * Drawn with rough.js through `roughHand()`, at SSR.
 */
const { t } = useI18n();
const { circle, line, arc } = roughHand();

const CELL = 236;
const Y = 92;
const R = 19;

const CELLS = [
  { key: 'sameProcess', hop: false, border: false, foreign: false },
  { key: 'anotherProcess', hop: true, border: false, foreign: false },
  { key: 'anotherRepo', hop: true, border: true, foreign: false },
  { key: 'anotherLanguage', hop: true, border: true, foreign: true },
] as const;

const cells = CELLS.map((c, i) => {
  const x0 = 30 + i * CELL;
  const ax = x0 + 34;
  const bx = x0 + 172;
  const from = ax + R + 6;
  const to = bx - R - 6;
  const mid = (from + to) / 2;

  return {
    ...c,
    caller: circle(ax, Y, R * 2, 3 + i),
    frond: circle(bx, Y, R * 2, 40 + i),
    // The link, and it is the only thing that differs from one cell to the next.
    wire: c.hop
      ? [...line(from, Y, mid - 17, Y, 70 + i), ...line(mid + 17, Y, to, Y, 80 + i)]
      : line(from, Y, to, Y, 70 + i),
    hopArc: c.hop ? arc(mid, Y, 56, 180, 360, 90 + i) : [],
    borderLine: c.border ? line(mid, Y - 40, mid, Y + 40, 100 + i) : [],
    label: { x: x0 + 103, y: Y + 74 },
    ax, bx,
  };
});
</script>

<template>
  <div class="not-prose my-2">
    <svg viewBox="0 0 980 200" class="hand-svg w-full h-auto" role="img" :aria-label="t('diagram.orbits.same')">
      <template v-for="(cell, i) in cells" :key="cell.key">
        <path v-for="(d, j) in cell.borderLine" :key="'b' + j" :d="d" class="hand-dashed" />
        <path v-for="(d, j) in cell.wire" :key="'w' + j" :d="d" class="hand-ink" />
        <path v-for="(d, j) in cell.hopArc" :key="'h' + j" :d="d" class="hand-accent" />
        <path v-for="(d, j) in cell.caller" :key="'c' + j" :d="d" class="hand-ink" />
        <path
          v-for="(d, j) in cell.frond" :key="'f' + j" :d="d"
          :class="cell.foreign ? 'hand-dashed' : 'hand-accent'"
        />
        <text :x="cell.label.x" :y="cell.label.y" text-anchor="middle" class="hand-members">
          {{ t(`diagram.orbits.${cell.key}`) }}
        </text>
        <template v-if="i === 0">
          <text :x="cell.ax" y="38" text-anchor="middle" class="hand-note">{{ t('diagram.orbits.caller') }}</text>
          <text :x="cell.bx" y="38" text-anchor="middle" class="hand-note">{{ t('diagram.orbits.frond') }}</text>
        </template>
      </template>
    </svg>
  </div>
</template>
