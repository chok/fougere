# Reading order

96 files of `src/`, in steps: a step depends only on the steps above it, and inside a step
there is nothing to order — a cycle is one step, not a sequence. Derived from the import
graph by the script at the bottom of `packages/schema/REVIEW.md` — regenerate it when the
tree moves.

Unlike `schema`, the families here interleave: `boot/` spans nine of the twelve steps,
`dispatch/` six. The step, not the directory, is what carries the order.

## 1 — What depends on nothing

The ports, the two builtins every app gets, and the values a call is made of.

[`storage.ts`](src/storage.ts) · [`emit.ts`](src/emit.ts) · [`loader.ts`](src/loader.ts) · [`builtin/logger.ts`](src/builtin/logger.ts) · [`builtin/config.ts`](src/builtin/config.ts)
· [`crypto/port.ts`](src/crypto/port.ts) · [`crypto/encoding.ts`](src/crypto/encoding.ts) · [`boot/ambient-port.ts`](src/boot/ambient-port.ts) · [`wire/Invocation.ts`](src/wire/Invocation.ts)
· [`wire/RouteAddress.ts`](src/wire/RouteAddress.ts) · [`wire/errors.ts`](src/wire/errors.ts) · [`wire/middleware.ts`](src/wire/middleware.ts) · [`wire/signature.ts`](src/wire/signature.ts)
· [`scan/conventions.ts`](src/scan/conventions.ts) · [`scan/adapters.ts`](src/scan/adapters.ts) · [`scan/bundling.ts`](src/scan/bundling.ts) · [`prefab/presenter.ts`](src/prefab/presenter.ts)
· [`prefab/collector.ts`](src/prefab/collector.ts) · [`dispatch/ArrayResult.ts`](src/dispatch/ArrayResult.ts)

## 2 — What travels, what holds rows, what a call passes through

[`wire/call.ts`](src/wire/call.ts) is the contract, and it carries `Call` itself since `contract/` was folded
into `wire/`. The five `dispatch/` files here are stages one call crosses, each readable
alone.

[`wire/call.ts`](src/wire/call.ts) · [`wire/CallLog.ts`](src/wire/CallLog.ts) · [`wire/binding.ts`](src/wire/binding.ts) · [`wire/http-error.ts`](src/wire/http-error.ts)
· [`wire/loggerMiddleware.ts`](src/wire/loggerMiddleware.ts) · [`rows.ts`](src/rows.ts) · [`source.ts`](src/source.ts) · [`dispatch/InFlight.ts`](src/dispatch/InFlight.ts)
· [`dispatch/validateInput.ts`](src/dispatch/validateInput.ts) · [`dispatch/OutputView.ts`](src/dispatch/OutputView.ts) · [`dispatch/PresenterExecutor.ts`](src/dispatch/PresenterExecutor.ts)
· [`dispatch/StorageGuard.ts`](src/dispatch/StorageGuard.ts) · [`prefab/prefab.ts`](src/prefab/prefab.ts) · [`prefab/repository.ts`](src/prefab/repository.ts) · [`prefab/mirror.ts`](src/prefab/mirror.ts)
· [`scan/handler-parser.ts`](src/scan/handler-parser.ts) · [`crypto/node.ts`](src/crypto/node.ts) · [`crypto/webcrypto.ts`](src/crypto/webcrypto.ts) · [`identity-keys.ts`](src/identity-keys.ts)
· [`boot/auth.ts`](src/boot/auth.ts) · [`boot/frame.ts`](src/boot/frame.ts) · [`boot/ambient.als.ts`](src/boot/ambient.als.ts) · [`boot/ambient.queue.ts`](src/boot/ambient.queue.ts)

## 3 — The route, and what an operation is

[`config-loader.ts`](src/config-loader.ts) · [`frond-config.ts`](src/frond-config.ts) · [`identity.ts`](src/identity.ts) · [`wire/operation.ts`](src/wire/operation.ts) · [`wire/drift.ts`](src/wire/drift.ts)
· [`dispatch/Route.ts`](src/dispatch/Route.ts) · [`dispatch/DispatchPort.ts`](src/dispatch/DispatchPort.ts) · [`dispatch/DispatchEvent.ts`](src/dispatch/DispatchEvent.ts)
· [`dispatch/ArgumentResolver.ts`](src/dispatch/ArgumentResolver.ts)

## 4 — What a user declares, and what a door does with it

[`descriptor/frond.ts`](src/descriptor/frond.ts) and [`descriptor/Fronds.ts`](src/descriptor/Fronds.ts) are one step: a descriptor names the
collection that holds it. The two `entry/` files are the three doors — `facade.ts` holds
both the facade and its dynamic form.

[`prefab/crud.ts`](src/prefab/crud.ts) · [`define.ts`](src/define.ts) · [`descriptor/frond.ts`](src/descriptor/frond.ts) ↔ [`descriptor/Fronds.ts`](src/descriptor/Fronds.ts) · [`contract.ts`](src/contract.ts)
· [`boot/apply.ts`](src/boot/apply.ts) · [`dispatch/OperationRoute.ts`](src/dispatch/OperationRoute.ts) · [`dispatch/OperationExecutor.ts`](src/dispatch/OperationExecutor.ts)
· [`dispatch/RouteResolver.ts`](src/dispatch/RouteResolver.ts) · [`dispatch/RoutePolicy.ts`](src/dispatch/RoutePolicy.ts) · [`dispatch/DispatchLifecycle.ts`](src/dispatch/DispatchLifecycle.ts)
· [`entry/facade.ts`](src/entry/facade.ts) · [`entry/transport.ts`](src/entry/transport.ts)

## 5 — Who owns what

The refusals: two owners for one key, a handler naming a port it may not name, a frame over
two engines, a collector in the wrong frond.

[`boot/ownership.ts`](src/boot/ownership.ts) · [`boot/ports.ts`](src/boot/ports.ts) · [`boot/together.ts`](src/boot/together.ts) · [`boot/remote.ts`](src/boot/remote.ts)
· [`boot/Emissions.ts`](src/boot/Emissions.ts) · [`declare.ts`](src/declare.ts) · [`verify.ts`](src/verify.ts) · [`imports.ts`](src/imports.ts) · [`graph.ts`](src/graph.ts)
· [`scan/result.ts`](src/scan/result.ts) · [`dispatch/RouteRegistry.ts`](src/dispatch/RouteRegistry.ts) · [`dispatch/routeNotFound.ts`](src/dispatch/routeNotFound.ts)
· [`dispatch/remoteRoutes.ts`](src/dispatch/remoteRoutes.ts) · [`dispatch/presenterArguments.ts`](src/dispatch/presenterArguments.ts)

## 6 — The dispatcher, then the disk

One path all three doors and the wire share, then what a scan makes of a directory.

[`dispatch/Dispatcher.ts`](src/dispatch/Dispatcher.ts) · [`dispatch/LocalRoutePolicy.ts`](src/dispatch/LocalRoutePolicy.ts) · [`scan/scanner.ts`](src/scan/scanner.ts) · [`scan/statement.ts`](src/scan/statement.ts)
· [`scan/emit.ts`](src/scan/emit.ts) · [`boot/hosted.ts`](src/boot/hosted.ts) · [`boot/statement-drift.ts`](src/boot/statement-drift.ts)

## 7 — What an operation effectively is

[`effective-operation.ts`](src/effective-operation.ts) alone — three producers folded into one contract, and the file
every projection reads.

## 8 — The façade, the card, the runners

[`boot/AppLifecycle.ts`](src/boot/AppLifecycle.ts) and [`boot/types.ts`](src/boot/types.ts) are one step: the app type names the
lifecycle, the lifecycle names the app.

[`boot/AppLifecycle.ts`](src/boot/AppLifecycle.ts) ↔ [`boot/types.ts`](src/boot/types.ts) · [`boot/HandlerFacade.ts`](src/boot/HandlerFacade.ts) · [`boot/card.ts`](src/boot/card.ts)
· [`boot/runner.ts`](src/boot/runner.ts) · [`boot/seed.ts`](src/boot/seed.ts)

## 9 — The boot

[`boot/bootstrap.ts`](src/boot/bootstrap.ts) alone — 773 lines, the longest file in the package and the last one
that can be read with everything else already known.

## 10 — The surface

[`boot/boot.ts`](src/boot/boot.ts) · [`index.ts`](src/index.ts) · [`node.ts`](src/node.ts) — what leaves the package, and the half that
assumes Node.
