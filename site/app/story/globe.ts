export interface GlobeState {
  unit: number;
  time: number;
  center: [number, number];
  marble: number;
  sphere: number;
  wound: number;
  split: number;
  lines: number;
}

interface Point {
  x: number;
  y: number;
  z: number;
}

interface Stroke {
  layer: CanvasRenderingContext2D;
  colour: string;
  alpha: number;
  width: number;
  path: Path2D;
}

const GRAPHITE = '23, 32, 26';
const THREADS = ['192, 96, 58', '74, 107, 140'];
const TILT = 0.32;
const MERIDIANS = 6;
const PARALLELS = [-0.55, 0, 0.55];
const TURNS = 4;

export default class Globe {
  constructor(
    private readonly back: HTMLCanvasElement,
    private readonly front: HTMLCanvasElement,
  ) {}

  draw(state: GlobeState, ratio: number) {
    const layers = { back: this.cleared(this.back, ratio), front: this.cleared(this.front, ratio) };
    if (state.sphere <= 0 || state.lines <= 0) return;
    const width = this.back.clientWidth;
    const height = this.back.clientHeight;
    const shell = state.marble * state.unit * (1 + 1.05 * state.sphere);
    const middle = { x: width / 2 + state.center[0] * state.unit, y: height / 2 - state.center[1] * state.unit };
    const apart = state.split * 0.125 * state.unit;
    const strokes = new Map<string, Stroke>();

    const trace = (points: Point[], colour: string, weight: number, strength: number) => {
      for (let i = 1; i < points.length; i++) {
        const depth = (points[i - 1]!.z + points[i]!.z) / 2 / shell;
        const near = Math.round(Math.max(0, -depth) * 3) / 3;
        const side = depth < 0 ? 'front' : 'back';
        const key = `${side}|${colour}|${weight}|${near}`;
        const stroke = strokes.get(key) ?? {
          layer: layers[side],
          colour,
          alpha: strength * state.lines * (0.35 + 0.65 * near),
          width: weight * (0.65 + 0.7 * near),
          path: new Path2D(),
        };
        strokes.set(key, stroke);
        stroke.path.moveTo(points[i - 1]!.x, points[i - 1]!.y);
        stroke.path.lineTo(points[i]!.x, points[i]!.y);
      }
    };

    for (const side of state.split > 0 ? [-1, 1] : [0]) {
      const spin = (side < 0 ? -1 : 1) * state.time * 0.22;
      const project = (x: number, y: number, z: number): Point => {
        const turnedX = x * Math.cos(spin) + z * Math.sin(spin);
        const turnedZ = -x * Math.sin(spin) + z * Math.cos(spin);

        return {
          x: middle.x + side * apart + turnedX,
          y: middle.y - (y * Math.cos(TILT) - turnedZ * Math.sin(TILT)),
          z: y * Math.sin(TILT) + turnedZ * Math.cos(TILT),
        };
      };
      const drawn = Math.PI * 2 * state.sphere;

      for (let meridian = 0; meridian < MERIDIANS; meridian++) {
        const longitude = (meridian * Math.PI) / MERIDIANS;
        trace(
          range(96, (t) => project(shell * Math.sin(t * drawn) * Math.cos(longitude), shell * Math.cos(t * drawn), shell * Math.sin(t * drawn) * Math.sin(longitude))),
          GRAPHITE, 1, 0.42,
        );
      }
      for (const latitude of PARALLELS) {
        trace(
          range(96, (t) => project(shell * Math.cos(latitude) * Math.cos(t * drawn), shell * Math.sin(latitude), shell * Math.cos(latitude) * Math.sin(t * drawn))),
          GRAPHITE, 1, 0.42,
        );
      }
      if (state.wound <= 0) continue;
      THREADS.forEach((colour, thread) => {
        const rising = range(30, (t) => project(0, shell * t * Math.min(1, state.wound * 6), 0));
        const winding = range(240, (t) => {
          const along = state.wound * t;
          const latitude = Math.PI / 2 - along * Math.PI;
          const longitude = thread * Math.PI + along * Math.PI * 2 * TURNS;

          return project(shell * Math.cos(latitude) * Math.cos(longitude), shell * Math.sin(latitude), shell * Math.cos(latitude) * Math.sin(longitude));
        });
        trace([project(0, 0, 0), ...rising, ...winding.slice(1)], colour, 2.6, 1);
      });
    }

    for (const stroke of strokes.values()) {
      stroke.layer.strokeStyle = `rgba(${stroke.colour}, ${stroke.alpha})`;
      stroke.layer.lineWidth = stroke.width;
      stroke.layer.stroke(stroke.path);
    }
  }

  private cleared(canvas: HTMLCanvasElement, ratio: number): CanvasRenderingContext2D {
    const width = Math.round(canvas.clientWidth * ratio);
    const height = Math.round(canvas.clientHeight * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const context = canvas.getContext('2d')!;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    context.lineCap = 'round';

    return context;
  }
}

function range(steps: number, at: (t: number) => Point): Point[] {
  return Array.from({ length: steps + 1 }, (_, step) => at(step / steps));
}
