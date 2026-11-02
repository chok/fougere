precision highp float;

uniform vec2 uResolution;
uniform float uUnit;
uniform float uTime;
uniform vec2 uCenter;
uniform float uAppear;
uniform float uSchema;
uniform float uFusion;
uniform float uGlobe;
uniform float uSplit;

const vec3 SAFFRON_LIGHT = vec3(.96, .82, .46);
const vec3 SAFFRON = vec3(.91, .72, .29);
const vec3 SAFFRON_SHADE = vec3(.72, .53, .17);
const vec3 GOLD_LIGHT = vec3(.96, .90, .66);
const vec3 GOLD = vec3(.87, .78, .50);
const vec3 GOLD_SHADE = vec3(.67, .57, .31);
const vec3 FERN_LIGHT = vec3(.66, .72, .42);
const vec3 FERN = vec3(.56, .63, .32);
const vec3 FERN_SHADE = vec3(.39, .43, .18);
const vec3 INK = vec3(.07, .11, .08);
const vec3 LIGHT = vec3(-.5, .6, -.65);

float smoothUnion(float a, float b, float k, out float share) {
  share = clamp(.5 + .5 * (b - a) / k, 0., 1.);

  return mix(b, a, share) - k * share * (1. - share);
}

vec3 schemaPosition() {
  float radius = mix(.46, 0., uFusion);
  float angle = uTime * .9 + uFusion * 7.;

  return vec3(cos(angle) * radius, sin(angle) * radius * .5, sin(angle) * radius * .7);
}

float shrink() {
  return uAppear * mix(1., .62, uGlobe) * mix(1., .6, uSplit);
}

float businessRadius() {
  return mix(.15, .185, uFusion) * shrink();
}

float schemaRadius() {
  return mix(0., .115, uSchema) * mix(1., .55, uFusion) * shrink() * (1. - smoothstep(0., .2, uSplit));
}

float scene(vec3 p, out float share) {
  float wobble = .005 * sin(7. * p.x + uTime * 1.9) * sin(6. * p.y + uTime * 1.4);
  vec3 apart = vec3(uSplit * .09, 0., 0.);
  float neck = max(.06 * smoothstep(0., .3, uSplit) * (1. - smoothstep(.55, .95, uSplit)), .0001);
  float halves;
  float business = smoothUnion(length(p - apart), length(p + apart), neck, halves) - businessRadius() + wobble;
  if (uAppear < .001) business = 10.;
  float schema = length(p - schemaPosition()) - schemaRadius();
  if (schemaRadius() < .0005) schema = 10.;

  return smoothUnion(business, schema, max(.11 * (1. - smoothstep(0., .3, uSplit)), .0001), share);
}

vec3 normalAt(vec3 p) {
  float share;
  vec2 e = vec2(.0015, 0.);

  return normalize(vec3(
    scene(p + e.xyy, share) - scene(p - e.xyy, share),
    scene(p + e.yxy, share) - scene(p - e.yxy, share),
    scene(p + e.yyx, share) - scene(p - e.yyx, share)
  ));
}

vec3 tone(float light, vec3 bright, vec3 middle, vec3 shade) {
  return light > .45 ? bright : light > -.05 ? middle : shade;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * uResolution) / uUnit;
  vec2 ground = (uv - uCenter - vec2(.03, -.24)) * vec2(1., 4.);
  float shadow = step(dot(ground, ground), .0055 * uAppear * uAppear) * (1. - uGlobe);
  vec4 color = vec4(INK, .1 * shadow);

  vec3 origin = vec3(uv - uCenter, -1.);
  vec3 ray = vec3(0., 0., 1.);
  float travelled = .3;
  float nearest = 10.;
  float share = 1.;
  bool hit = false;
  for (int i = 0; i < 64; i++) {
    float gap = scene(origin + ray * travelled, share);
    nearest = min(nearest, gap);
    if (gap < .0006) { hit = true; break; }
    travelled += gap;
    if (travelled > 2.) break;
  }
  float coverage = hit ? 1. : 1. - smoothstep(0., 1.6 / uUnit, nearest);

  if (coverage > 0.) {
    vec3 point = origin + ray * travelled;
    vec3 normal = normalAt(point);
    scene(point, share);
    float fern = smoothstep(.42, .58, share);
    vec3 light = normalize(LIGHT);
    float lit = dot(normal, light);
    float rim = 1. + dot(normal, ray);

    vec3 saffron = tone(lit, SAFFRON_LIGHT, SAFFRON, SAFFRON_SHADE);
    vec3 fused = mix(tone(lit, FERN_LIGHT, FERN, FERN_SHADE), tone(lit, GOLD_LIGHT, GOLD, GOLD_SHADE), uFusion);
    vec3 marble = mix(saffron, fused, fern);
    marble = mix(marble, mix(vec3(.99, .98, .94), vec3(.92, .94, .82), fern), step(.985, dot(reflect(ray, normal), light)));
    marble = mix(marble, INK, step(.93, rim));
    color = vec4(mix(color.rgb, marble, coverage), max(color.a, coverage));
  }

  gl_FragColor = color;
}
