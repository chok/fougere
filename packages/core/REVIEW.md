# Reading order

99 files of `src/`, in an order where nothing is forward-referenced: each step depends only
on the ones above it. Derived from the import graph by the script at the bottom of
`packages/schema/REVIEW.md` — regenerate it when the tree moves.

Unlike `schema`, the families here interleave: `dispatch/` spans five steps and `boot/`
seven. The step, not the directory, is what carries the order.

## 1 — What depends on nothing

The ports, the two builtins every app gets, and the values a call is made of.

[`storage.ts`](src/storage.ts) · [`emit.ts`](src/emit.ts) · [`loader.ts`](src/loader.ts) · [`contract/Invocation.ts`](src/contract/Invocation.ts) · [`contract/RouteAddress.ts`](src/contract/RouteAddress.ts)
· [`builtins/logger.ts`](src/builtins/logger.ts) · [`builtins/config.ts`](src/builtins/config.ts) · [`crypto/port.ts`](src/crypto/port.ts) · [`crypto/encoding.ts`](src/crypto/encoding.ts)
· [`boot/ambient-port.ts`](src/boot/ambient-port.ts) · [`wire/errors.ts`](src/wire/errors.ts) · [`wire/middleware.ts`](src/wire/middleware.ts) · [`wire/signature.ts`](src/wire/signature.ts)
· [`scan/conventions.ts`](src/scan/conventions.ts) · [`scan/adapters.ts`](src/scan/adapters.ts) · [`scan/bundling.ts`](src/scan/bundling.ts) · [`prefab/presenter.ts`](src/prefab/presenter.ts)
· [`prefab/collector.ts`](src/prefab/collector.ts) · [`dispatch/ArrayResult.ts`](src/dispatch/ArrayResult.ts) · [`dispatch/OutputView.ts`](src/dispatch/OutputView.ts)
· [`entry/DynamicFacade.ts`](src/entry/DynamicFacade.ts)

## 2 — What travels, what holds rows, what a call passes through

[`wire/call.ts`](src/wire/call.ts) is the contract; the four `dispatch/` files here are the stages one call
crosses, each readable alone.

[`contract/Call.ts`](src/contract/Call.ts) · [`contract/CallLog.ts`](src/contract/CallLog.ts) · [`wire/call.ts`](src/wire/call.ts) · [`wire/binding.ts`](src/wire/binding.ts)
· [`wire/http-error.ts`](src/wire/http-error.ts) · [`wire/loggerMiddleware.ts`](src/wire/loggerMiddleware.ts) · [`rows.ts`](src/rows.ts) · [`source.ts`](src/source.ts)
· [`dispatch/InFlight.ts`](src/dispatch/InFlight.ts) · [`dispatch/InputValidator.ts`](src/dispatch/InputValidator.ts) · [`dispatch/OutputProjector.ts`](src/dispatch/OutputProjector.ts)
· [`dispatch/PresenterExecutor.ts`](src/dispatch/PresenterExecutor.ts) · [`dispatch/StorageGuard.ts`](src/dispatch/StorageGuard.ts) · [`prefab/prefab.ts`](src/prefab/prefab.ts)
· [`prefab/repository.ts`](src/prefab/repository.ts) · [`prefab/mirror.ts`](src/prefab/mirror.ts) · [`scan/handler-parser.ts`](src/scan/handler-parser.ts)
· [`crypto/node.ts`](src/crypto/node.ts) · [`crypto/webcrypto.ts`](src/crypto/webcrypto.ts) · [`identity-keys.ts`](src/identity-keys.ts) · [`boot/auth.ts`](src/boot/auth.ts)
· [`boot/frame.ts`](src/boot/frame.ts) · [`boot/ambient.als.ts`](src/boot/ambient.als.ts) · [`boot/ambient.queue.ts`](src/boot/ambient.queue.ts)

## 3 — The route, and what an operation is

[`config-loader.ts`](src/config-loader.ts) · [`frond-config.ts`](src/frond-config.ts) · [`identity.ts`](src/identity.ts) · [`wire/operation.ts`](src/wire/operation.ts) · [`wire/drift.ts`](src/wire/drift.ts)
· [`dispatch/Route.ts`](src/dispatch/Route.ts) · [`dispatch/DispatchPort.ts`](src/dispatch/DispatchPort.ts) · [`dispatch/DispatchEvent.ts`](src/dispatch/DispatchEvent.ts)
· [`dispatch/ArgumentResolver.ts`](src/dispatch/ArgumentResolver.ts) · [`boot/remote.ts`](src/boot/remote.ts)

## 4 — What a user declares, and what a door does with it

[`prefab/crud.ts`](src/prefab/crud.ts) · [`define.ts`](src/define.ts) · [`descriptor/frond.ts`](src/descriptor/frond.ts) · [`contract.ts`](src/contract.ts) · [`boot/apply.ts`](src/boot/apply.ts)
· [`dispatch/OperationRoute.ts`](src/dispatch/OperationRoute.ts) · [`dispatch/OperationExecutor.ts`](src/dispatch/OperationExecutor.ts) · [`dispatch/RouteResolver.ts`](src/dispatch/RouteResolver.ts)
· [`dispatch/RoutePolicy.ts`](src/dispatch/RoutePolicy.ts) · [`dispatch/DispatchLifecycle.ts`](src/dispatch/DispatchLifecycle.ts) · [`entry/FacadeEntry.ts`](src/entry/FacadeEntry.ts)
· [`entry/TransportEntry.ts`](src/entry/TransportEntry.ts)

## 5 — Who owns what

The refusals: two owners for one key, a handler naming a port it may not name, a frame
over two engines.

[`boot/ownership.ts`](src/boot/ownership.ts) · [`boot/ports.ts`](src/boot/ports.ts) · [`boot/together.ts`](src/boot/together.ts) · [`declare.ts`](src/declare.ts)
· [`descriptor/Fronds.ts`](src/descriptor/Fronds.ts) · [`verify.ts`](src/verify.ts) · [`imports.ts`](src/imports.ts) · [`graph.ts`](src/graph.ts)
· [`dispatch/RouteRegistry.ts`](src/dispatch/RouteRegistry.ts) · [`dispatch/RouteNotFoundError.ts`](src/dispatch/RouteNotFoundError.ts)
· [`dispatch/RemoteRouteResolver.ts`](src/dispatch/RemoteRouteResolver.ts) · [`dispatch/PresenterArgumentResolver.ts`](src/dispatch/PresenterArgumentResolver.ts)

## 6 — The dispatcher, then the disk

One path all three doors and the wire share, then what a scan makes of a directory.

[`dispatch/Dispatcher.ts`](src/dispatch/Dispatcher.ts) · [`dispatch/LocalRoutePolicy.ts`](src/dispatch/LocalRoutePolicy.ts) · [`boot/Emissions.ts`](src/boot/Emissions.ts)
· [`scan/result.ts`](src/scan/result.ts) · [`scan/scanner.ts`](src/scan/scanner.ts) · [`scan/statement.ts`](src/scan/statement.ts) · [`scan/emit.ts`](src/scan/emit.ts)
· [`boot/hosted.ts`](src/boot/hosted.ts) · [`boot/statement-drift.ts`](src/boot/statement-drift.ts)

## 7 — What an operation effectively is

[`effective-operation.ts`](src/effective-operation.ts) alone — three producers folded into one contract, and the file
every projection reads.

## 8 — The façade, the card, the runners

[`boot/HandlerFacade.ts`](src/boot/HandlerFacade.ts) · [`boot/types.ts`](src/boot/types.ts) · [`boot/AppLifecycle.ts`](src/boot/AppLifecycle.ts) · [`boot/card.ts`](src/boot/card.ts)
· [`boot/runner.ts`](src/boot/runner.ts)

## 9 — The boot

[`boot/bootstrap.ts`](src/boot/bootstrap.ts) is the longest file in the package and the last one that can be read
with everything else already known.

[`boot/bootstrap.ts`](src/boot/bootstrap.ts) · [`boot/seed.ts`](src/boot/seed.ts) · [`boot/boot.ts`](src/boot/boot.ts)

## 10 — The surface

[`index.ts`](src/index.ts) · [`node.ts`](src/node.ts) — what leaves the package, and the half that assumes Node.
