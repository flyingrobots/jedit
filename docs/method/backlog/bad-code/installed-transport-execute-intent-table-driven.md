---
title: installed-transport-execute-intent-table-driven
lane: bad-code
owner: jedit transport
priority: medium
keywords:
  - transport
  - duplication
  - dispatch
  - operation-table
---

# `executeXxxIntent` functions are near-identical copy-paste

## Where

`src/adapters/installed-jedit-contract-echo-transport.ts`:

- `executeCreateBufferIntent`
- `executeReplaceRangeIntent`
- `executeCreateCheckpointIntent`

## Smell

Each function is ~15 lines doing the same shape:

```ts
const invocation = invokeSchedulerHandler(mutations, invocationSink, (registry) => (
    registry.execute<OperationName>Mutation(request)
));
if (invocation.status === JEDIT_HANDLER_INVOCATION_STATUS_BLOCKED) {
    return obstructedIntent(request, invocation.obstruction);
}
return {
    status: JEDIT_TRANSPORT_STATUS_OK,
    operationName: <OP_CONSTANT>,
    execution: invocation.result,
};
```

The only differences are the registry method called and the literal
operation-name constant. Three near-identical functions; `executeIntent`
is a hand-written switch routing to them.

## Suggested refactor

Table-driven dispatch keyed by `operationName`:

```ts
const MUTATION_DISPATCH = {
  [CREATE_BUFFER_WORLDLINE_OPERATION]: (registry, request) =>
    registry.executeCreateBufferWorldlineMutation(request),
  [REPLACE_RANGE_AS_TICK_OPERATION]: (registry, request) =>
    registry.executeReplaceRangeAsTickMutation(request),
  [CREATE_CHECKPOINT_OPERATION]: (registry, request) =>
    registry.executeCreateCheckpointMutation(request),
} as const;
```

`executeIntent` becomes:

```ts
const handler = MUTATION_DISPATCH[request.operationName];
const invocation = invokeSchedulerHandler(mutations, invocationSink, (r) => handler(r, request));
if (invocation.status === JEDIT_HANDLER_INVOCATION_STATUS_BLOCKED) {
    return obstructedIntent(request, invocation.obstruction);
}
return { status: JEDIT_TRANSPORT_STATUS_OK, operationName: request.operationName, execution: invocation.result };
```

Three handlers + one switch + three result-builders collapse to one
table + one builder.

## Why it matters

The pattern recurs in `fake-echo-jedit-optic-transport.ts` and will
recur in the EINT cutover when the transport learns to dispatch by
op_id. Doing it three more times multiplies the smell.

## Related

- [[optic-codec-mixes-wire-with-session]] — the EINT cutover is a
  good moment to also collapse this dispatch into a single table.
