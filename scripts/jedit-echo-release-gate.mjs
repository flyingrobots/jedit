#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const DEFAULT_PACKAGE_DESCRIPTOR = 'src/app/jedit-contract-package.ts';
const DEFAULT_OBSERVER_WITNESS = 'spec/jedit-contract-query-observers.spec.mjs';
const FOCUSED_TESTS = Object.freeze([
  'spec/jedit-contract-package.spec.mjs',
  'spec/jedit-contract-package-preflight.spec.mjs',
  'spec/jedit-contract-package-install.spec.mjs',
  'spec/jedit-contract-mutation-handlers.spec.mjs',
  'spec/jedit-contract-query-observers.spec.mjs',
  'spec/jedit-runtime-handler-invocation.spec.mjs',
  'spec/installed-jedit-contract-echo-transport.spec.mjs',
  'spec/jedit-contract-entity-facts.spec.mjs',
  'spec/jedit-contract-state-port.spec.mjs',
  'spec/jedit-echo-retention-lookup.spec.mjs',
  'spec/jedit-receipt-correlation.spec.mjs',
  'spec/jedit-submission-ledger.spec.mjs',
  'spec/jedit-ticketed-runtime-ingress.spec.mjs',
  'spec/jedit-ticketed-work-boundary.spec.mjs',
  'spec/jedit-restart-witness.spec.mjs',
  'spec/jedit-restart-recovery.spec.mjs',
  'spec/echo-hosting-counter-template.spec.mjs',
  'spec/trusted-echo-runtime-loop.spec.mjs',
  'spec/jedit-intent-outcomes.spec.mjs',
  'spec/jedit-retained-evidence.spec.mjs',
  'spec/echo-powered-session-witness-cli.spec.mjs',
  'spec/jedit-echo-release-gate-report.spec.mjs',
  'spec/jedit-echo-witness-mcp-adapter.spec.mjs',
  'spec/jedit-restart-posture.spec.mjs',
  'spec/jedit-local-replay-proof.spec.mjs',
  'spec/echo-application-hosting-guide.spec.mjs',
  'spec/text-runtime-profile-session.spec.mjs',
  'spec/production-text-session.spec.mjs',
  'spec/production-text-session-witness.spec.mjs',
  'spec/production-text-session-cli.spec.mjs',
  'spec/workspace-text-cutover.spec.mjs',
  'spec/workspace-app-echo-cutover.spec.mjs',
  'spec/workspace-text-boundaries.spec.mjs',
  'spec/workspace-echo-witness-cli.spec.mjs',
  'spec/jedit-wsc-restart-round-trip.spec.mjs',
  'spec/jedit-wsc-history-basis.spec.mjs',
  'spec/jedit-wsc-current-history-export.spec.mjs',
  'spec/jedit-wsc-history-listing.spec.mjs',
  'spec/jedit-wsc-replay-proof.spec.mjs',
  'spec/jedit-wsc-agent-history-cli.spec.mjs',
  'spec/production-cutover-guard.spec.mjs',
  'spec/release-quickstart.spec.mjs',
]);

const options = parseArgs(process.argv.slice(2));
const metadataStatus = checkRequiredFile(options.packageDescriptor, 'package descriptor')
  || checkRequiredFile(options.observerWitness, 'observer witness');

if (metadataStatus !== 0) {
  process.exitCode = metadataStatus;
} else if (options.metadataOnly) {
  process.stdout.write('jedit Echo release gate metadata ok\n');
} else if (options.jsonReport) {
  process.exitCode = runJsonReport();
} else {
  process.exitCode = runReleaseGate();
}

function parseArgs(args) {
  const options = {
    packageDescriptor: DEFAULT_PACKAGE_DESCRIPTOR,
    observerWitness: DEFAULT_OBSERVER_WITNESS,
    metadataOnly: false,
    jsonReport: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--metadata-only') {
      options.metadataOnly = true;
    } else if (arg === '--json-report') {
      options.jsonReport = true;
    } else if (arg === '--package-descriptor') {
      options.packageDescriptor = requiredValue(args, index, arg);
      index += 1;
    } else if (arg === '--observer-witness') {
      options.observerWitness = requiredValue(args, index, arg);
      index += 1;
    } else {
      process.stderr.write(`unknown argument: ${arg}\n`);
      process.exit(1);
    }
  }

  return options;
}

function requiredValue(args, index, arg) {
  const value = args[index + 1];
  if (value == null || value.startsWith('--')) {
    process.stderr.write(`missing value for ${arg}\n`);
    process.exit(1);
  }
  return value;
}

function checkRequiredFile(filePath, label) {
  if (existsSync(filePath)) {
    return 0;
  }
  process.stderr.write(`missing ${label}: ${filePath}\n`);
  return 1;
}

function runReleaseGate() {
  return runCommand('npm', ['run', '--silent', 'build'])
    || runCommand(process.execPath, ['--test', '--test-concurrency=1', ...FOCUSED_TESTS])
    || runCommand(process.execPath, ['scripts/jedit-production-cutover-guard.mjs'])
    || runCommand('npm', ['run', '--silent', 'quality']);
}

function runJsonReport() {
  const build = runCommandCapture('npm', ['run', '--silent', 'build']);
  if (build.status !== 0) {
    return emitReportFailure('build_failed', build);
  }
  const happy = runWitnessJson(['--json', '--text', 'release gate']);
  const nonHappy = runWitnessJson(['--json', '--unsupported-mutation', 'unsupportedMutation']);
  const replay = runWitnessJson(['--json', '--replay-local', '--text', 'release gate']);
  if (!happy.ok) {
    return emitReportFailure('happy_path_failed', happy.result);
  }
  if (!nonHappy.ok) {
    return emitReportFailure('non_happy_path_failed', nonHappy.result);
  }
  if (!replay.ok) {
    return emitReportFailure('local_replay_failed', replay.result);
  }
  process.stdout.write(`${JSON.stringify(toReleaseGateReport(happy.summary, nonHappy.summary, replay.summary), null, 2)}\n`);
  return 0;
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
  return result.status ?? 1;
}

function runWitnessJson(args) {
  const result = runCommandCapture(process.execPath, ['scripts/jedit-echo-powered-session.mjs', ...args]);
  if (result.status !== 0) {
    return {
      ok: false,
      result,
    };
  }
  return parseJsonResult(result);
}

function runCommandCapture(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function parseJsonResult(result) {
  try {
    return {
      ok: true,
      summary: JSON.parse(result.stdout),
      result,
    };
  } catch (cause) {
    return {
      ok: false,
      result: {
        ...result,
        stderr: cause instanceof Error ? cause.message : String(cause),
      },
    };
  }
}

function emitReportFailure(reason, result) {
  process.stdout.write(`${JSON.stringify({
    ok: false,
    schemaVersion: 1,
    reason,
    status: result.status,
    stderr: result.stderr,
  }, null, 2)}\n`);
  return result.status === 0 ? 1 : result.status;
}

function toReleaseGateReport(happy, nonHappy, replay) {
  return {
    ok: true,
    schemaVersion: 1,
    transport: happy.transport,
    install: happy.install,
    authority: toAuthorityReport(happy),
    happyPath: toHappyPathReport(happy),
    nonHappyPath: nonHappy.nonHappyPath,
    replay: replay.replayLocal,
    releaseGate: {
      hiddenRetry: nonHappy.nonHappyPath.hiddenRetry,
      appCanTick: happy.authority.appCanTick,
      retainedEvidenceRefCount: happy.report.retainedEvidence.refs.length,
    },
  };
}

function toAuthorityReport(happy) {
  return {
    appFacingSessionPort: happy.authority.appFacingSessionPort,
    appFacingBufferCapability: happy.authority.appFacingBufferCapability,
    trustedLifecyclePort: happy.authority.trustedLifecyclePort,
    appCanTick: happy.authority.appCanTick,
    lifecycleRequests: happy.lifecycleRequests,
    shutdown: happy.shutdown,
  };
}

function toHappyPathReport(happy) {
  return {
    outcome: happy.report.outcome.status,
    roundTrip: happy.report.roundTrip,
    receiptCorrelation: happy.report.receiptCorrelation.status,
    retainedEvidence: happy.report.retainedEvidence,
    reading: happy.reading,
    restartPosture: happy.report.restartPosture,
  };
}
