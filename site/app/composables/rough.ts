import rough from 'roughjs/bundled/rough.esm.js';

/**
 * The house hand. One generator, one set of options, so every diagram on the site is
 * drawn by the same wrist — and a fixed seed per shape means a rebuild redraws it
 * identically instead of re-rolling the wobble.
 *
 * `rough.generator()` needs no DOM: it returns path data, which we render as ordinary
 * `<path>` elements. So this runs during SSR and the strokes arrive in the HTML.
 */
const HAND = { roughness: 1.6, bowing: 2.2 } as const;

const gen = rough.generator();
const d = (drawable: ReturnType<typeof gen.circle>) => gen.toPaths(drawable).map((p) => p.d);
const rad = (deg: number) => (deg * Math.PI) / 180;

export function roughHand() {
  return {
    circle: (x: number, y: number, size: number, seed: number) =>
      d(gen.circle(x, y, size, { ...HAND, seed })),

    /**
     * Angles in degrees, y-down: 180→360 is the upper half.
     *
     * `single` draws one pass instead of rough's usual two. It matters for a dotted or
     * dashed stroke: two passes are offset from each other, so each one's gaps land on
     * the other's ink and the line comes out looking solid.
     */
    arc: (x: number, y: number, size: number, from: number, to: number, seed: number, single = false) =>
      d(gen.arc(x, y, size, size, rad(from), rad(to), false, { ...HAND, seed, disableMultiStroke: single })),

    line: (x1: number, y1: number, x2: number, y2: number, seed: number) =>
      d(gen.line(x1, y1, x2, y2, { ...HAND, seed })),

    /** A line plus its two head strokes, pointing at (x2, y2). */
    arrow: (x1: number, y1: number, x2: number, y2: number, seed: number) => {
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const head = (spread: number) => [
        x2 - 15 * Math.cos(angle - spread),
        y2 - 15 * Math.sin(angle - spread),
      ] as const;
      const [ax, ay] = head(0.42);
      const [bx, by] = head(-0.42);
      return [
        ...d(gen.line(x1, y1, x2, y2, { ...HAND, seed })),
        ...d(gen.line(ax, ay, x2, y2, { ...HAND, seed: seed + 1 })),
        ...d(gen.line(bx, by, x2, y2, { ...HAND, seed: seed + 2 })),
      ];
    },
  };
}
