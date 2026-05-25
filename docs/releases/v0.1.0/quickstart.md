# jedit + Echo v0.1.0 Quickstart

This quickstart proves the current release-gate claim:

```text
jedit can run a narrow edit/read flow through an Echo-backed installed contract
package path while Echo remains generic.
```

## Commands

Build the generated contract helpers and TypeScript output:

```bash
npm run build
```

Inspect the witness plan without running the edit/read flow:

```bash
node scripts/jedit-echo-powered-session.mjs --json --dry-run
```

Run the installed-package edit/read witness:

```bash
node scripts/jedit-echo-powered-session.mjs --json --text "hello Echo"
```

Run the production text session witness:

```bash
node scripts/jedit-production-text-session.mjs --json --text "hello Echo"
```

Compare two local witness runs using stable evidence identity:

```bash
node scripts/jedit-echo-powered-session.mjs --json --replay-local
node scripts/jedit-production-text-session.mjs --json --replay-local
```

Start the interactive app with the Echo-hosted production text profile:

```bash
JEDIT_TEXT_RUNTIME=echoHosted npm start
```

## Expected JSON Shape

The real witness should include these stable fields:

```json
{
  "ok": true,
  "transport": "installed-jedit-contract",
  "dryRun": false,
  "install": {
    "packageId": "jedit.hot-text-runtime"
  },
  "authority": {
    "appFacingSessionPort": "TextBufferSessionPort",
    "appFacingBufferCapability": "TextBufferOptic",
    "appCanTick": false
  },
  "report": {
    "outcome": {
      "status": "APPLIED"
    },
    "retainedEvidence": {
      "refs": []
    },
    "restartPosture": {
      "status": "PARTIAL",
      "acceptedSubmissionRecovery": "UNAVAILABLE"
    }
  },
  "replay": {
    "status": "UNAVAILABLE"
  }
}
```

The local replay command should report:

```json
{
  "ok": true,
  "replayLocal": {
    "status": "MATCH",
    "wallClockCadenceSemantic": false
  }
}
```

## Troubleshooting

Missing generated files:

- Run `npm run build`.

Missing Echo WASM module:

- This quickstart does not require the legacy Echo WASM stack-witness fixture.
  The active release-gate path uses the installed jedit contract transport.

Unsupported observer or query:

- Confirm the witness reports `transport: "installed-jedit-contract"`.
- Confirm the package install summary names `jedit.hot-text-runtime`.
- Unsupported query means no jedit-owned observer is registered for that query.

Replay unavailable:

- `report.restartPosture.acceptedSubmissionRecovery` is currently
  `UNAVAILABLE`.
- `--replay-local` proves local deterministic reruns. It is not Continuum
  transport, durable accepted-submission recovery, or distributed replay.

Authority violation:

- Application code must not tick Echo.
- `TextBufferOptic` is a jedit capability.
- `echoHosted` is the production text runtime profile.
- `testLocal` is a dev/test fixture profile, not a product mode.
- Echo sees generic package, operation, query, handler, observer, receipt, and
  reading evidence surfaces.
