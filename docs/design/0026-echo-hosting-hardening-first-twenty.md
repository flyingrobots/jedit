# Echo Hosting Hardening - Next Twenty Slices

Status: active follow-on plan

This plan extends the reusable Echo application-hosting pattern after
[`0025-echo-application-hosting-pattern.md`](0025-echo-application-hosting-pattern.md).
The goal is still not release ceremony. The goal is to make `jedit` a
credible proof app for Echo without teaching Echo any `jedit` semantics.

## Claim

`jedit` should be powered by Echo through ports, adapters, generated helpers,
installed contract packages, trusted runtime lifecycle control, bounded
readings, retained evidence, and replay witnesses. Echo must remain generic:
it owns admission, scheduling, ticks, receipts, query routing, retention, and
fault posture; `jedit` owns editor vocabulary, text law, handler behavior,
query observer behavior, and app-safe capability APIs.

## Slice Budget

### Slice 41 - Trusted Runtime Lifecycle Doctrine Closure

User story: As a host operator, I can start, drain, and stop the trusted Echo
runtime without giving application code tick authority.

Test plan:

- Lifecycle port exposes start, run-until-idle, and stop.
- Lifecycle port exposes no discrete tick injection.
- Session witness records host lifecycle requests separately from app intent.

Checklist:

- [x] Trusted start cadence exists on the lifecycle port.
- [x] Start cadence remains trusted host control.
- [x] Application capability still exposes no tick control.
- [x] Witness summary records start, drain, and stop posture.

### Slice 42 - Runtime Host Port Finalization

User story: As a future Echo app author, I can depend on a lifecycle port shape
that describes host policy instead of raw Echo control bytes.

Test plan:

- Adapter encodes start/drain/stop through the trusted host control transport.
- Failed start does not mark the host loop as running.
- App-facing sessions do not expose the lifecycle port.

Checklist:

- [x] Lifecycle codec owns start/drain/stop bytes.
- [x] Trusted runtime loop calls lifecycle start before it can drain.
- [x] Rejected start leaves drain unavailable.
- [x] App-facing sessions expose no lifecycle methods.

### Slice 43 - Echo Adapter Lifecycle Integration

User story: As `jedit`, the real Echo-powered witness can report host lifecycle
posture next to app submission and reading evidence.

Test plan:

- CLI witness reports startup, drain, and shutdown.
- CLI witness keeps app-facing capability separate from trusted host lifecycle.
- CLI witness still reports bounded reading evidence.

Checklist:

- [x] CLI witness records startup.
- [x] CLI witness records drain.
- [x] CLI witness records shutdown.
- [x] CLI witness still returns reading evidence.

### Slice 44 - Lifecycle Failure Posture

User story: As a host operator, a rejected lifecycle start is not silently
converted into a running loop.

Test plan:

- Runtime loop rejected start returns stopped posture.
- Drain after rejected start returns not-running posture.
- No scheduler drain request is issued after rejected start.

Checklist:

- [x] Rejected start posture is tested.
- [x] Drain is blocked after rejected start.
- [x] No hidden run-until-idle happens after rejected start.

### Slice 45 - Agent Lifecycle Surface

User story: As an agent, I can run the `jedit` Echo witness through the CLI/MCP
surface without receiving lifecycle or tick authority.

Test plan:

- MCP adapter exposes only the witness call.
- CLI emits lifecycle posture as evidence.
- Neither surface exposes tick, start, stop, or raw trusted lifecycle methods.

Checklist:

- [x] MCP adapter remains witness-only.
- [x] CLI exposes lifecycle posture as data.
- [x] Agent-facing surface has no tick authority.

### Slice 46 - Contract Package Identity Audit

User story: As a trusted host, I can install a package through one descriptor
that binds schema, artifact, codec, mutation operations, query operations, and
observer plan identities.

Test plan:

- Installer forwards all descriptor identity fields to the generic package host.
- Recording host treats exact duplicate install as idempotent.
- Recording host rejects conflicting package identity for the same package id.

Checklist:

- [x] Package install request carries complete identity.
- [x] Duplicate identical install is idempotent.
- [x] Conflicting same-id package install is blocked.

### Slice 47 - No App Nouns In Echo Gate

User story: As an Echo maintainer, I can prove production Echo source does not
carry hardcoded `jedit` fixture shortcuts.

Test plan:

- Echo guard scans production crate source for forbidden app-specific fixture
  tokens.
- Guard passes on current Echo main.
- Guard does not ban generic byte/text buffer implementation vocabulary.

Checklist:

- [x] Echo source noun guard exists.
- [x] Guard targets production crate source.
- [x] Guard passes after Stack Witness shortcut removal.

### Slice 48 - jedit Contract Package Install Fixture

User story: As `jedit`, I can inject a package host and prove package install
posture controls whether runtime work can reach handlers.

Test plan:

- Installed transport accepts injected package host.
- Non-installed package posture obstructs before handler invocation.
- Non-installed package posture obstructs before runtime work envelope staging.

Checklist:

- [x] Installed transport accepts package host injection.
- [x] Blocked install obstructs mutation response.
- [x] Blocked install does not invoke handlers.
- [x] Blocked install does not stage runtime work.

### Slice 49 - Unsupported Operation Boundary

User story: As `jedit`, unsupported mutation and query names fail before they
become runtime-visible work or accepted reads.

Test plan:

- Package operation classifier rejects unsupported mutation.
- Package operation classifier rejects unsupported query.
- Unsupported operation witness is final for that attempt.

Checklist:

- [x] Unsupported mutation classification exists.
- [x] Unsupported query classification exists.
- [x] Unsupported mutation CLI witness has no hidden retry.

### Slice 50 - Package Reinstall And Duplicate Policy

User story: As a trusted host, reinstalling the same package is safe, while a
same-id package with changed identity is blocked.

Test plan:

- First install succeeds.
- Identical reinstall succeeds.
- Same package id with different artifact identity is blocked.

Checklist:

- [x] First install succeeds.
- [x] Identical reinstall succeeds.
- [x] Conflicting reinstall is blocked.

## Drift Closure Before Slice 51

The slice-50 reflection found four drift risks. They are closed or explicitly
bounded here before the next slice batch starts.

Checklist:

- [x] Local witness evidence is stamped as `LOCAL_PROCESS_WITNESS` and does not
  claim durable receipt correlation, ticketed runtime ingress, or accepted
  submission recovery.
- [x] Retained material lookup requires both byte identity and semantic
  coordinate match; byte hash alone is not retained evidence.
- [x] Echo's app-noun guard is intentionally production-source-scoped. Tests and
  docs may contain app-shaped fixtures only as external-consumer examples.
- [x] Durable restart persistence remains future work under slice 55; current
  witness output must continue reporting partial restart posture.
- [x] PR/CI review state remains branch process, not architectural truth.
- [x] `TextBufferSessionPort` owns the jedit app-facing session boundary, while
  `createEchoBackedTextBufferSession(...)` is only one adapter behind the port.

### Slice 51 - Ticketed Mutation Execution Tightening

User story: As `jedit`, mutation handlers run only after ticketed runtime work
is available and scheduler authority is present.

Test plan:

- Unticketed work cannot invoke handlers.
- Application capability cannot invoke handlers.
- Scheduler authority remains a runtime object, not an app string.

Checklist:

- [x] Unticketed work blocks handler invocation.
- [x] App authority cannot invoke handlers.
- [x] Scheduler authority object is explicit.

### Slice 52 - Query Observer Read-Only Tightening

User story: As `jedit`, query observers can read bounded state but cannot write
or tick.

Test plan:

- Query observer context has no write methods.
- Query observer context has no lifecycle or tick methods.
- Query observer failures map to query obstruction, not package install
  failure.

Checklist:

- [x] Query observer context remains read-only.
- [x] Query observer has no lifecycle surface.
- [x] Query runtime failures remain typed.

### Slice 53 - Receipt Correlation Happy Path Closure

User story: As `jedit`, an applied mutation can be mapped to the receipt that
decided it without fabricating receipt evidence.

Test plan:

- Applied mutation reports real correlation.
- Unsupported mutation reports missing/unsupported correlation.
- Correlation identity survives witness summary serialization.

Checklist:

- [x] Applied mutation reports real correlation.
- [x] Unsupported mutation does not fabricate receipt.
- [x] CLI summary carries correlation identity.

### Slice 54 - Retained Reading Lookup Closure

User story: As an agent, I can inspect retained reading material by semantic
coordinate and byte identity.

Test plan:

- Reading envelope lookup works.
- Reading payload lookup works.
- Same bytes under different semantic coordinates do not alias.

Checklist:

- [x] Envelope lookup works.
- [x] Payload lookup works.
- [x] Semantic coordinate mismatch is not a cache hit.

### Slice 55 - Restart Persistence Adapter Boundary

User story: As a host operator, pending and decided submission posture can be
loaded through a restart adapter instead of process-local memory claims.

Test plan:

- Pending posture loads through adapter.
- Decided posture loads through adapter.
- Half-accepted posture remains obstructed.

Checklist:

- [x] Restart adapter exists.
- [x] Pending posture loads.
- [x] Decided posture loads.
- [x] Half-accepted posture is blocked.

### Slice 56 - Local Replay Proof Hardening

User story: As a maintainer, replay compares semantic receipt and reading
identity, not wall-clock timing or diagnostic strings.

Test plan:

- Replay witness compares package, receipt, reading, and payload identity.
- Wall-clock cadence is explicitly non-semantic.
- Diagnostic strings do not decide replay equality.

Checklist:

- [x] Replay identity excludes wall-clock timing.
- [x] Replay equality avoids diagnostic prose.
- [x] Replay witness is deterministic.

### Slice 57 - Second-App Template Authority Audit

User story: As a future app author, the counter template proves the pattern
without importing `jedit` product modules.

Test plan:

- Counter template install path passes.
- Counter template mutation/query path passes.
- Static import audit rejects `jedit` product imports.

Checklist:

- [x] Counter install path passes.
- [x] Counter mutation/query path passes.
- [x] Import audit passes.

### Slice 58 - Developer Guide Drift Check

User story: As a developer, the hosting guide matches the executable witness
commands and current port names.

Test plan:

- Guide command snippets run or are checked by tests.
- Guide names current lifecycle and package ports.
- Guide does not imply app-controlled ticking.

Checklist:

- [x] Guide commands are current.
- [x] Port names are current.
- [x] Tick authority doctrine is correct.

### Slice 59 - PR Release Gate Consolidation

User story: As a reviewer, one command proves the current `jedit` Echo hosting
surface.

Test plan:

- Release gate runs build, quality, hosting witness, replay witness, and core
  static guards.
- Failure output names the failed witness.

Checklist:

- [x] Release gate includes hosting witness.
- [x] Release gate includes replay witness.
- [x] Release gate includes static guards.

### Slice 60 - Drift Reflection And Next Plan

User story: As maintainers, we can pause after the hardening batch and decide
whether the next work is receipt correlation, retention, replay, UI adoption,
or Echo core support.

Test plan:

- Reflection document names remaining gaps.
- BEARING points at the next active plan.
- No completed slice is left unchecked.

Checklist:

- [ ] Reflection exists.
- [ ] BEARING is current.
- [ ] Next active slice is explicit.
