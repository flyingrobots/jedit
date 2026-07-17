# jedit v0.1.0 Echo Release Gate

Status: **retired and invalidated**.

The former v0.1.0 release gate claimed that Jim was powered by Echo for a
narrow edit/read workflow. Audit showed that the normal path admitted work,
scheduled it, mutated text, constructed receipts, stored graph facts, and
served observations inside process-local TypeScript. Echo-shaped interfaces
did not make that execution Echo authority.

## What Was Removed

- the full-snapshot text runtime fixture from production source;
- the TypeScript graph-rope execution runtime;
- the local installed-contract transport and EINT bridge;
- local mutation handlers, query observers, submission ledgers, and state
  authority used by that path;
- fake Echo transports and production fixture CLIs;
- executable documentation that promoted local replay as Echo evidence.

## Current Boundary

Jim now launches a trusted native Echo host, registers a package generated
from a narrow GraphQL contract by Echo's Wesley extension, and performs
create/open, single-range replacement, and bounded reads through real Echo
admission, scheduling, graph history, receipts, observations, and WAL recovery.
Unsupported operations fail closed.

Echo remains generic. Jim owns rope and editor semantics. Edict will replace
the transitional Wesley/Rust invocation corridor. Echo owns admission,
scheduling, ticks, receipts, witnessed causal history, and basis-pinned
observations.

## Evidence Commands

```bash
npm run build
node scripts/jedit-production-cutover-guard.mjs
npm run witness:echo
npm run check
```

## Historical Artifacts

The following files are retained only as audit artifacts:

- [`final-witness-report.json`](final-witness-report.json)
- [`local-replay-report.json`](local-replay-report.json)
- [`pr-notes.md`](pr-notes.md)

Their successful statuses describe the retired local witness. They are not
current Echo integration receipts and must not be cited as proof of production
authority.

See [quickstart.md](quickstart.md) for the honest current startup posture.
