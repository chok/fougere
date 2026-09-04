# Reading order

99 files of `src/`, in an order where nothing is forward-referenced: each step depends only
on the ones above it. Derived from the import graph by the script at the bottom of
`packages/schema/REVIEW.md` — regenerate it when the tree moves.

Unlike `schema`, the families here interleave: `dispatch/` spans five steps and `boot/`
seven. The step, not the directory, is what carries the order.

## 1 — What depends on nothing

The ports, the two builtins every app gets, and the values a call is made of.

`storage.ts` · `emit.ts` · `loader.ts` · `contract/Invocation.ts` · `contract/RouteAddress.ts`
· `builtins/logger.ts` · `builtins/config.ts` · `crypto/port.ts` · `crypto/encoding.ts`
· `boot/ambient-port.ts` · `wire/errors.ts` · `wire/middleware.ts` · `wire/signature.ts`
· `scan/conventions.ts` · `scan/adapters.ts` · `scan/bundling.ts` · `prefab/presenter.ts`
· `prefab/collector.ts` · `dispatch/ArrayResult.ts` · `dispatch/OutputView.ts`
· `entry/DynamicFacade.ts`

## 2 — What travels, what holds rows, what a call passes through

`wire/call.ts` is the contract; the four `dispatch/` files here are the stages one call
crosses, each readable alone.

`contract/Call.ts` · `contract/CallLog.ts` · `wire/call.ts` · `wire/binding.ts`
· `wire/http-error.ts` · `wire/loggerMiddleware.ts` · `rows.ts` · `source.ts`
· `dispatch/InFlight.ts` · `dispatch/InputValidator.ts` · `dispatch/OutputProjector.ts`
· `dispatch/PresenterExecutor.ts` · `dispatch/StorageGuard.ts` · `prefab/prefab.ts`
· `prefab/repository.ts` · `prefab/mirror.ts` · `scan/handler-parser.ts`
· `crypto/node.ts` · `crypto/webcrypto.ts` · `identity-keys.ts` · `boot/auth.ts`
· `boot/frame.ts` · `boot/ambient.als.ts` · `boot/ambient.queue.ts`

## 3 — The route, and what an operation is

`config-loader.ts` · `frond-config.ts` · `identity.ts` · `wire/operation.ts` · `wire/drift.ts`
· `dispatch/Route.ts` · `dispatch/DispatchPort.ts` · `dispatch/DispatchEvent.ts`
· `dispatch/ArgumentResolver.ts` · `boot/remote.ts`

## 4 — What a user declares, and what a door does with it

`prefab/crud.ts` · `define.ts` · `descriptor/frond.ts` · `contract.ts` · `boot/apply.ts`
· `dispatch/OperationRoute.ts` · `dispatch/OperationExecutor.ts` · `dispatch/RouteResolver.ts`
· `dispatch/RoutePolicy.ts` · `dispatch/DispatchLifecycle.ts` · `entry/FacadeEntry.ts`
· `entry/TransportEntry.ts`

## 5 — Who owns what

The refusals: two owners for one key, a handler naming a port it may not name, a frame
over two engines.

`boot/ownership.ts` · `boot/ports.ts` · `boot/together.ts` · `declare.ts`
· `descriptor/Fronds.ts` · `verify.ts` · `imports.ts` · `graph.ts`
· `dispatch/RouteRegistry.ts` · `dispatch/RouteNotFoundError.ts`
· `dispatch/RemoteRouteResolver.ts` · `dispatch/PresenterArgumentResolver.ts`

## 6 — The dispatcher, then the disk

One path all three doors and the wire share, then what a scan makes of a directory.

`dispatch/Dispatcher.ts` · `dispatch/LocalRoutePolicy.ts` · `boot/Emissions.ts`
· `scan/result.ts` · `scan/scanner.ts` · `scan/statement.ts` · `scan/emit.ts`
· `boot/hosted.ts` · `boot/statement-drift.ts`

## 7 — What an operation effectively is

`effective-operation.ts` alone — three producers folded into one contract, and the file
every projection reads.

## 8 — The façade, the card, the runners

`boot/HandlerFacade.ts` · `boot/types.ts` · `boot/AppLifecycle.ts` · `boot/card.ts`
· `boot/runner.ts`

## 9 — The boot

`boot/bootstrap.ts` is the longest file in the package and the last one that can be read
with everything else already known.

`boot/bootstrap.ts` · `boot/seed.ts` · `boot/boot.ts`

## 10 — The surface

`index.ts` · `node.ts` — what leaves the package, and the half that assumes Node.
