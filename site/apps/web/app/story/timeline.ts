export function band(from: number, to: number, progress: number): number {
  const x = Math.min(Math.max((progress - from) / (to - from), 0), 1);

  return x * x * (3 - 2 * x);
}

const CHAPTERS = [0.08, 0.2, 0.41, 0.66, 0.9];

export const ANCHORS = ['code', 'schema', 'derivation', 'choices', 'rule'];

export function progressOf(anchor: string): number | undefined {
  const index = ANCHORS.indexOf(anchor);
  if (index < 0) return undefined;

  return (CHAPTERS[index]! + (CHAPTERS[index + 1] ?? 1)) / 2;
}

export function chapterAt(progress: number): number {
  if (progress < 0.04) return 0;
  if (progress < CHAPTERS[0]!) return -1;

  return CHAPTERS.filter((start) => progress >= start).length;
}

export function phasesAt(progress: number) {
  const rest = band(0.9, 0.98, progress);
  const globe = band(0.44, 0.56, progress) * (1 - rest);
  const split = band(0.66, 0.86, progress) * (1 - rest);
  const appear = progress >= 0.095 ? 1 : 0;

  return {
    travel: band(0.01, 0.1, progress),
    morph: band(0.03, 0.1, progress),
    fill: band(0.06, 0.09, progress),
    plate: 1 - band(0.055, 0.09, progress),
    fern: 1 - band(0.1, 0.115, progress),
    appear,
    schema: band(0.15, 0.23, progress),
    fusion: band(0.2, 0.4, progress),
    globe,
    sphere: band(0.44, 0.54, progress),
    wound: band(0.5, 0.62, progress),
    split,
    lines: 1 - rest,
    marble: 0.185 * appear * (1 - 0.38 * globe) * (1 - 0.4 * split),
  };
}
