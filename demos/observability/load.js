/**
 * k6 against the shop's JSON-RPC door.
 *
 * Staged on purpose: a flat rate draws flat lines and there is nothing to read in them.
 * The ramp, the plateau, the spike and the drain are what make latency, saturation and
 * error rate say something on a dashboard.
 *
 *   k6 run load.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const SHOP = 'http://127.0.0.1:4200/_fougere/call';

const checkoutTime = new Trend('fougere_checkout', true);
const reportTime = new Trend('fougere_report', true);

export const options = {
  stages: [
    { duration: '30s', target: 5 },    // ramp — the system wakes up
    { duration: '45s', target: 5 },    // plateau — this is what "normal" looks like
    { duration: '15s', target: 30 },   // spike — six times the load, in fifteen seconds
    { duration: '45s', target: 30 },   // held — does latency hold or does it bend
    { duration: '30s', target: 0 },    // drain — saturation should return to zero
  ],
  thresholds: {
    // A refusal is not a failure: `reserve` is meant to refuse. Only transport errors count.
    http_req_failed: ['rate<0.01'],
    'fougere_checkout': ['p(95)<500'],
  },
};

let id = 0;

function call(method, params = {}) {
  return http.post(
    SHOP,
    JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params: { params: {}, query: {}, body: undefined, state: {}, ...params } }),
    { headers: { 'content-type': 'application/json' }, tags: { op: method } },
  );
}

export default function () {
  const roll = Math.random();

  if (roll < 0.7) {
    const res = call('cart.checkout');
    checkoutTime.add(res.timings.duration);
    check(res, { 'checkout answered': (r) => r.status === 200 && !JSON.parse(r.body).error });
  } else if (roll < 0.93) {
    const res = call('cart.report');
    reportTime.add(res.timings.duration);
    check(res, { 'report answered': (r) => r.status === 200 && !JSON.parse(r.body).error });
  } else {
    // Deliberately refused by the catalog — this is what feeds the error rate.
    const res = call('product.reserve');
    check(res, { 'reserve refused as designed': (r) => r.status === 200 && JSON.parse(r.body).error !== undefined });
  }

  sleep(0.2 + Math.random() * 0.4);
}
