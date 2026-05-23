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
    bufferKey: DEFAULT_BUFFER_KEY,
    insertText: DEFAULT_INSERT_TEXT,
    cycleLimit: DEFAULT_CYCLE_LIMIT,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') {
      options.json = true;
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
  const lifecycleRequests = [];
  const lifecycle = {
    requestRunUntilIdle(request) {
      lifecycleRequests.push({ cycleLimit: request.cycleLimit });
      return {
        accepted: true,
        lastRunCompletion: RUNTIME_COMPLETION_QUIESCED,
      };
    },
  };
  const client = modules.transportClient.createEchoTransportJeditOpticClient(
    modules.fakeTransport.createFakeEchoJeditOpticTransport(),
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

  return {
    ok: true,
    schemaVersion: 1,
    transport: 'fake-echo-shaped',
    authority: {
      appFacingCapability: 'TextBufferOptic',
      appCanTick: false,
      trustedLifecyclePort: 'TrustedEchoRuntimeLifecyclePort',
    },
    lifecycleRequests,
    report,
  };
}

async function loadDistModules() {
  return {
    fakeTransport: await importDist('adapters/fake-echo-jedit-optic-transport.js'),
    transportClient: await importDist('adapters/jedit-echo-optic-client.js'),
    poweredSession: await importDist('app/echo-powered-text-buffer-optic-session.js'),
    workflow: await importDist('app/echo-powered-text-buffer-witness.js'),
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
  --json                  Emit machine-readable summary.
  --help                  Show this help text.
`;
}

process.exitCode = await main();
