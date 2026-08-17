<script setup lang="ts">
/**
 * The declaration in the middle, two rings around it — each two thirds of a circle, so
 * they read as orbits rather than brackets.
 *
 * Each ring's gap faces the side where the OTHER one's arrows pass: the outer ring is the
 * public surface and its doors leave leftward, the inner ring is the driven side and its
 * arrows escape rightward through the outer gap. Every arrow departs from its own ring,
 * never from the core — a door is not something the core reaches for.
 *
 * The prose is the page's job. This holds eight words. Drawn with rough.js through
 * `roughHand()`, which runs during SSR.
 */
const { t } = useI18n();
const { circle, arc, arrow } = roughHand();

const CX = 520;
const CY = 330;
const CORE = 132;
const SURFACE = 600;   // outer ring — two thirds, its gap on the right
const PORTS = 420;     // inner ring — two thirds, its gap on the left

/** Degrees, y-down: 180 is due left, 0 due right. */
const DOORS = [
  { deg: 210, label: 'call envelope' },
  { deg: 180, label: 'REST' },
  { deg: 150, label: 'GraphQL' },
] as const;

const DRIVEN = [
  { deg: -45, label: 'SQL' },
  { deg: 0, label: 'remotes:' },
  { deg: 45, label: 'Mirror' },
] as const;

const rad = (d: number) => (d * Math.PI) / 180;
const at = (deg: number, r: number) => ({ x: CX + r * Math.cos(rad(deg)), y: CY + r * Math.sin(rad(deg)) });

const shapes = {
  core: circle(CX, CY, CORE, 3),
  surface: arc(CX, CY, SURFACE, 60, 300, 11),
  ports: arc(CX, CY, PORTS, -120, 120, 17),
};

/** Every arrow departs from its own arc, never from the core. */
const TERMINUS = SURFACE / 2 + 64;
const raysFrom = (orbit: number, list: readonly { deg: number; label: string }[], seed0: number) =>
  list.map((ray, i) => {
    const from = at(ray.deg, orbit / 2);
    const to = at(ray.deg, TERMINUS);
    return { ...ray, paths: arrow(from.x, from.y, to.x, to.y, seed0 + i * 3), tip: at(ray.deg, TERMINUS + 10) };
  });

const doors = raysFrom(SURFACE, DOORS, 40);
const driven = raysFrom(PORTS, DRIVEN, 70);
</script>

<template>
  <div class="not-prose my-2">
    <svg viewBox="0 0 1000 680" class="hand-svg w-full h-auto" role="img" :aria-label="t('diagram.arcs.core')">
      <path v-for="(d, i) in shapes.surface" :key="'s' + i" :d="d" class="hand-accent" />
      <path v-for="(d, i) in shapes.ports" :key="'p' + i" :d="d" class="hand-faint" />

      <template v-for="ray in driven" :key="ray.label">
        <path v-for="(d, i) in ray.paths" :key="i" :d="d" class="hand-faint" />
        <text :x="ray.tip.x + 6" :y="ray.tip.y + 5" class="hand-members">{{ ray.label }}</text>
      </template>

      <template v-for="door in doors" :key="door.label">
        <path v-for="(d, i) in door.paths" :key="i" :d="d" class="hand-accent" />
        <text :x="door.tip.x - 6" :y="door.tip.y + 5" text-anchor="end" class="hand-members">{{ door.label }}</text>
      </template>

      <path v-for="(d, i) in shapes.core" :key="'c' + i" :d="d" class="hand-ink" />
      <text x="520" y="336" text-anchor="middle" class="hand-title">{{ t('diagram.arcs.core') }}</text>

      <text x="180" y="26" text-anchor="middle" class="hand-note">{{ t('diagram.arcs.surface') }}</text>

      <text x="836" y="662" text-anchor="middle" class="hand-note">{{ t('diagram.arcs.ports') }}</text>
    </svg>
  </div>
</template>
