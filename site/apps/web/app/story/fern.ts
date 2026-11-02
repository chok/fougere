import plate from './fern-outline.json';

export interface FernFrame {
  outline: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function fernFrame(start: { x: number; y: number }, end: { x: number; y: number }, size: number, radius: number, travel: number, morph: number, lift: number): FernFrame {
  const x = start.x + (end.x - start.x) * travel;
  const y = start.y + (end.y - start.y) * travel - Math.sin(travel * Math.PI) * lift;
  const height = size * (1 - 0.45 * morph);
  const outline = plate.points.map(([along, across], index) => {
    const dx = along! * height;
    const dy = across! * height;
    const length = Math.hypot(dx, dy) || 1;
    const px = x + dx + ((dx / length) * radius - dx) * morph;
    const py = y + dy + ((dy / length) * radius - dy) * morph;

    return `${index ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`;
  });

  return { outline: `${outline.join('')}Z`, x: x - (height * plate.ratio) / 2, y: y - height / 2, width: height * plate.ratio, height };
}
