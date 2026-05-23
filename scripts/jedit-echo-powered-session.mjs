#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const DEFAULT_BUFFER_KEY = 'agent-demo.txt';
const DEFAULT_INSERT_TEXT = 'hello';
const DEFAULT_CYCLE_LIMIT = 4;
const FIRST_BYTE = 0;
const FIRST_LINE = 0;
const SINGLE_LINE_WINDOW = 1;
const DEFAULT_MAX_BYTES = 1024;
const RUNTIME_COMPLETION_QUIESCED = 'quiesced';
const TRANSPORT_INSTALLED_PACKAGE = 'installed-jedit-contract';
const REPLAY_POSTURE_UNAVAILABLE = 'UNAVAILABLE';

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(helpText());
    return 0;
  }
  if (options.errorMessage != null) {
    emitFailure(options, options.errorMessage);
    return 1;
  }

  try {
    const summary = await runSessionWitness(options);
    emitSummary(options, summary);
    return 0;
  } catch (cause) {
    emitFailure(options, cause instanceof Error ? cause.message : String(cause));
    return 1;
  }
}

function parseArgs(args) {
  const options = {
    json: false,
    help: false,
    dryRun: false,
    bufferKey: DEFAULT_BUFFER_KEY,
    insertText: DEFAULT_INSERT_TEXT,
    cycleLimit: DEFAULT_CYCLE_LIMIT,
    unsupportedMutation: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') {
      options.json = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--buffer-key') {
      const value = nextArg(args, index);
      if (value === undefined) {
        return { ...options, errorMessage: `missing value for ${arg}` };
      }
      options.bufferKey = value;
      index += 1;
    } else if (arg === '--text') {
      const value = nextArg(args, index);
      if (value === undefined) {
        return { ...options, errorMessage: `missing value for ${arg}` };
      }
      options.insertText = value;
      index += 1;
    } else if (arg === '--cycle-limit') {
      const value = nextArg(args, index);
      if (value === undefined) {
        return { ...options, errorMessage: `missing value for ${arg}` };
      }
      const cycleLimit = parseCycleLimit(value);
      if (cycleLimit == null) {
        return { ...options, errorMessage: `invalid cycle limit: ${value}` };
      }
      options.cycleLimit = cycleLimit;
      index += 1;
    } else if (arg === '--unsupported-mutation') {
      const value = nextArg(args, index);
      if (value === undefined) {
        return { ...options, errorMessage: `missing value for ${arg}` };
      }
      options.unsupportedMutation = value;
      index += 1;
    } else {
      return { ...options, errorMessage: `unknown argument: ${arg}` };
    }
  }

  return options;
}

function nextArg(args, index) {
  const value = args[index + 1];
  if (value == null || value.startsWith('--')) {
    return undefined;
  }
  return value;
}

function parseCycleLimit(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed.toString() === value
    ? parsed
    : undefined;
}

async function runSessionWitness(options) {
  const modules = await loadDistModules();
  if (options.dryRun) {
    return dryRunSummary(options, modules.package);
  }
  if (options.unsupportedMutation != null) {
    return unsupportedMutationSummary(options, modules);
  }

  const lifecycleRequests = [];
  const stopRequests = [];
  const lifecycle = {
    requestRunUntilIdle(request) {
      lifecycleRequests.push({ cycleLimit: request.cycleLimit });
      return {
        accepted: true,
        lastRunCompletion: RUNTIME_COMPLETION_QUIESCED,
      };
    },
    requestStop() {
      stopRequests.push({ requested: true });
      return {
        accepted: true,
        lastRunCompletion: 'stopped',
      };
    },
  };
  const client = modules.transportClient.createEchoTransportJeditOpticClient(
    modules.installedTransport.createInstalledJeditContractEchoTransport(),
  );
  const session = modules.poweredSession.createEchoPoweredTextBufferOpticSession({
    client,
    lifecycle,
    cycleLimit: options.cycleLimit,
  });
  const report = await modules.workflow.runEchoPoweredTextBufferWitness(session, {
    bufferKey: options.bufferKey,
    initialText: '',
    startByte: FIRST_BYTE,
    endByte: FIRST_BYTE,
    insertText: options.insertText,
    cursorLine: FIRST_LINE,
    beforeLines: FIRST_LINE,
    viewportLineCount: SINGLE_LINE_WINDOW,
    afterLines: FIRST_LINE,
    maxBytes: DEFAULT_MAX_BYTES,
  });
  const shutdown = modules.host.stopTrustedEchoRuntime(lifecycle);

  return {
    ok: true,
    schemaVersion: 1,
    transport: TRANSPORT_INSTALLED_PACKAGE,
    dryRun: false,
    install: installSummary(modules.package),
    authority: {
      appFacingCapability: 'TextBufferOptic',
      appCanTick: false,
      trustedLifecyclePort: 'TrustedEchoRuntimeLifecyclePort',
    },
    lifecycleRequests,
    stopRequests,
    shutdown,
    report,
    reading: {
      readingId: report.readingId,
      lineCount: report.lines.length,
      truncated: report.truncated,
    },
    replay: unavailableReplayPosture(),
  };
}

function unsupportedMutationSummary(options, modules) {
  const intent = modules.outcomes.createJeditIntentHandle(
    options.unsupportedMutation,
    `unsupported:${options.unsupportedMutation}`,
  );
  const outcome = modules.outcomes.createJeditIntentOutcomeLedger().obstructIntent(
    intent,
    modules.preflight.JEDIT_PACKAGE_REQUEST_UNSUPPORTED_MUTATION,
  );

  return {
    ok: true,
    schemaVersion: 1,
    transport: TRANSPORT_INSTALLED_PACKAGE,
    dryRun: false,
    install: installSummary(modules.package),
    nonHappyPath: {
      kind: modules.preflight.classifyJeditPackageOperationRequest(
        modules.preflight.jeditMutationOperationRequest(options.unsupportedMutation),
      ),
      outcome,
      hiddenRetry: false,
      healthyLaterWorkCanProceed: true,
      retryDoctrine: 'retry requires a new explicit causal input',
    },
    replay: unavailableReplayPosture(),
  };
}

function dryRunSummary(options, packageModule) {
  return {
    ok: true,
    schemaVersion: 1,
    transport: TRANSPORT_INSTALLED_PACKAGE,
    dryRun: true,
    install: installSummary(packageModule),
    plan: {
      bufferKey: options.bufferKey,
      cycleLimit: options.cycleLimit,
      submitIntent: true,
      trustedHostDrainsRuntime: true,
      appCanTick: false,
    },
    replay: unavailableReplayPosture(),
  };
}

function installSummary(packageModule) {
  return {
    packageId: packageModule.JEDIT_HOT_TEXT_PACKAGE_ID,
    version: packageModule.JEDIT_HOT_TEXT_PACKAGE_VERSION,
    schemaId: packageModule.JEDIT_HOT_TEXT_SCHEMA_ID,
    artifactId: packageModule.JEDIT_HOT_TEXT_ARTIFACT_ID,
    codecId: packageModule.JEDIT_HOT_TEXT_CODEC_ID,
  };
}

function unavailableReplayPosture() {
  return {
    status: REPLAY_POSTURE_UNAVAILABLE,
    reason: 'local replay proof is scheduled for a later release-gate slice',
  };
}

async function loadDistModules() {
  return {
    installedTransport: await importDist('adapters/installed-jedit-contract-echo-transport.js'),
    transportClient: await importDist('adapters/jedit-echo-optic-client.js'),
    poweredSession: await importDist('app/echo-powered-text-buffer-optic-session.js'),
    workflow: await importDist('app/echo-powered-text-buffer-witness.js'),
    host: await importDist('app/trusted-echo-runtime-host.js'),
    package: await importDist('app/jedit-contract-package.js'),
    preflight: await importDist('app/jedit-contract-package-preflight.js'),
    outcomes: await importDist('app/jedit-intent-outcomes.js'),
  };
}

async function importDist(relativePath) {
  try {
    return await import(pathToFileURL(path.join(REPO_ROOT, 'dist', relativePath)).href);
  } catch (cause) {
    throw new Error(
      `dist/${relativePath} is unavailable; run npm run build before invoking this witness.`,
      { cause },
    );
  }
}

function emitSummary(options, summary) {
  if (options.json) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    return;
  }
  process.stdout.write(`jedit Echo-powered session passed: ${summary.report.text}\n`);
}

function emitFailure(options, message) {
  if (options.json) {
    process.stdout.write(`${JSON.stringify({ ok: false, message }, null, 2)}\n`);
    return;
  }
  process.stderr.write(`jedit Echo-powered session failed: ${message}\n`);
}

function helpText() {
  return `Usage: node scripts/jedit-echo-powered-session.mjs [options]

Options:
  --buffer-key <path>     Buffer key for the synthetic session.
  --text <text>           Text inserted by the replace-range intent.
  --cycle-limit <n>       Trusted host run-until-idle cycle limit.
  --unsupported-mutation <name>
                          Return an unsupported-mutation outcome without retrying.
  --dry-run               Emit the planned installed-package witness without running it.
  --json                  Emit machine-readable summary.
  --help                  Show this help text.
`;
}

process.exitCode = await main();
