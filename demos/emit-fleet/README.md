# emit-fleet — a hub and N devices over one socket

One project, **three Fronds**, two deployments. No broker, no infrastructure.

```
fronds/fleet/entities/   Recalibrate, Reading   ← the contract, declared ONCE
fronds/hub/handlers/     FleetHandler            ← announces down, listens up
fronds/node/handlers/    SensorHandler           ← listens down, announces up
```

```bash
pnpm install && pnpm -r build

# terminal 1
pnpm hub

# terminals 2, 3, 4
NODE_ID=sensor-1 pnpm node
NODE_ID=sensor-2 pnpm node
NODE_ID=sensor-3 pnpm node
```

`fronds: ['fleet', 'hub']` and `fronds: ['fleet', 'node']` are the whole deployment
statement. Both halves sit on the same disk; each process loads its own subset, which is
why nothing local can shortcut the tunnel.

## The three things it shows

**1. It reconnects.** Start a device *before* the hub:

```
[sensor-9] link down — retrying in 500ms
[sensor-9] link down — retrying in 1000ms
[sensor-9] link down — retrying in 2000ms
[sensor-9] link down — retrying in 4000ms
[sensor-9] connected — listens to sendCalibration     ← the hub appeared; nobody touched it
```

Backoff doubles and stops at 5 s. A device may be down for hours.

**2. Readings come UP the same socket.** A device behind a NAT cannot be called — it calls,
and the connection is bidirectional:

```
[hub] sensor-1 → 25.8°C
[hub] sensor-2 → 23.7°C
```

The hub calls `app.deliver(fact, payload)` and **not** the emission value: resolving that
would carry the reading straight back out through `onEmit` and echo it to the whole fleet.
Receiving and announcing are two operations; only one of them leaves.

**3. One device can be addressed — in the data.**

```
→ sensor-2 only: offset -3
[hub] sendCalibration → 3 device(s)
  [sensor-1] recalibration for sensor-2 — not mine
  [sensor-2] recalibrated, offset -3
  [sensor-3] recalibration for sensor-2 — not mine
```

`remotes:` names a *kind* of Frond, never an instance, so the device's name travels **with
the fact** and each one decides for itself. It works, and the cost is on the screen: three
devices woken for an order meant for one. At five hundred it is no longer a detail.

## What it does not do

- **Nothing is held.** A device that was offline when an order went out never gets it. That
  is exactly what a queue adds, and the tunnel has none.
- **The hub believes what a device says about itself.** Identity arrives on the wire and
  nothing re-establishes it — see the repository's known issues.
- **One socket per device, in one process.** Fine for a hundred, a single point at scale.
