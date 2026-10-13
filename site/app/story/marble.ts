import fragment from './marble.frag?raw';

const VERTEX = 'attribute vec2 corner; void main() { gl_Position = vec4(corner, 0., 1.); }';

const UNIFORMS = ['uResolution', 'uUnit', 'uTime', 'uCenter', 'uAppear', 'uSchema', 'uFusion', 'uGlobe', 'uSplit'] as const;

export interface MarbleState {
  unit: number;
  time: number;
  center: [number, number];
  appear: number;
  schema: number;
  fusion: number;
  globe: number;
  split: number;
}

export default class Marble {
  private readonly uniforms: Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly gl: WebGLRenderingContext,
    program: WebGLProgram,
  ) {
    this.uniforms = Object.fromEntries(UNIFORMS.map((name) => [name, gl.getUniformLocation(program, name)])) as Marble['uniforms'];
  }

  static on(canvas: HTMLCanvasElement): Marble | undefined {
    const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false, alpha: true });
    if (!gl) return undefined;
    const program = gl.createProgram()!;
    for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, fragment]] as const) {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'marble shader');
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const corner = gl.getAttribLocation(program, 'corner');
    gl.enableVertexAttribArray(corner);
    gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);

    return new Marble(canvas, gl, program);
  }

  draw(state: MarbleState, ratio: number) {
    const { canvas, gl, uniforms } = this;
    const width = Math.round(canvas.clientWidth * ratio);
    const height = Math.round(canvas.clientHeight * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
    gl.uniform2f(uniforms.uResolution, width, height);
    gl.uniform1f(uniforms.uUnit, state.unit * ratio);
    gl.uniform1f(uniforms.uTime, state.time);
    gl.uniform2f(uniforms.uCenter, state.center[0], state.center[1]);
    gl.uniform1f(uniforms.uAppear, state.appear);
    gl.uniform1f(uniforms.uSchema, state.schema);
    gl.uniform1f(uniforms.uFusion, state.fusion);
    gl.uniform1f(uniforms.uGlobe, state.globe);
    gl.uniform1f(uniforms.uSplit, state.split);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
