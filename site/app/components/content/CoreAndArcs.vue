<script setup lang="ts">
/**
 * The declaration in the middle, two rings around it — each two thirds of a circle, so
 * they read as orbits rather than brackets.
 *
 * Arrows carry the FLOW TOWARD THE CONSUMER: SQL, a remote Frond and a mirrored API
 * SUPPLY, so they arrive; the surface SERVES, so it publishes outward. One stream, right
 * to left, and the Frond is what it crosses.
 *
 * NOTHING touches the Frond. Every arrow runs between its own ring and the outside: the
 * surface publishes outward, the supply arrives at the port. The core never talks to SQL
 * and never emits a route — it hands over at a ring, and the ring is where the arrow
 * stops. A head landing on the circle would claim the opposite.
 *
 * What is Fougere's own is carried by the STROKE, not by a bent arrow: the outer ring is
 * dashed because you did not write it — it is derived from the declaration — while the
 * inner one is solid, because you plug those in yourself.
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

/** Out to the consumer, or in from the supply — and it stops at its ring either way. */
const stream = (
  list: readonly { deg: number; label: string }[],
  ring: number,
  outward: boolean,
  seed0: number,
) =>
  list.map((ray, i) => {
    const inner = at(ray.deg, ring / 2 + 6);
    const outer = at(ray.deg, ring / 2 + 66);
    const [from, to] = outward ? [inner, outer] : [outer, inner];
    return { ...ray, paths: arrow(from.x, from.y, to.x, to.y, seed0 + i * 3), tip: at(ray.deg, ring / 2 + 78) };
  });

const doors = stream(DOORS, SURFACE, true, 40);
const driven = stream(DRIVEN, PORTS, false, 70);
</script>

<template>
  <div class="not-prose my-2">
    <svg viewBox="0 0 1000 680" class="hand-svg w-full h-auto" role="img" :aria-label="t('diagram.arcs.core')">
      <path v-for="(d, i) in shapes.surface" :key="'s' + i" :d="d" class="hand-dashed" />
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
