# Echo Authoritative Recovery Gate B

This is the jedit-local companion to Echo's
`docs/design/echo-authoritative-jedit-recovery-40-slice-plan.md`.

Gate B asks one question:

```text
Can jedit consume Echo truth through ports without local memory fallback?
```

The required artifact is a jedit recovery report that proves:

- jedit asks Echo for generic recovery posture through an app-owned port;
- process, path, CLI, and WAL details stay adapter-private;
- generic Echo posture is mapped into jedit-owned editor status;
- stable edit submission identity makes retry safe;
- legacy local text memory is blocked by static and runtime tripwires;
- bounded readings and materialized artifacts come from Echo recovery evidence.

## Slice Checklist

- [x] Slice 18: Echo recovery port interface.
- [x] Slice 19: Echo recovery adapter implementation.
- [x] Slice 20: Generic-to-editor posture mapping.
- [x] Slice 21: Stable edit submission identity.
- [x] Slice 22: Recovery evidence report fields.
- [x] Slice 32: Production legacy memory static guard.
- [x] Slice 33: Release-gate runtime tripwire mode.
- [x] Slice 23: Recovered bounded reading path.
- [ ] Slice 24: Happy-path recovery gate scenario.
- [ ] Slice 25: Retry after local amnesia scenario.
- [ ] Slice 34: Materialize artifact from recovered causal basis.

Check off each slice here and in `docs/BEARING.md` immediately before the
commit that lands the slice.
