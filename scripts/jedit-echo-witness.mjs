#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createNodeEchoWitnessRunnerAdapter } from './adapters/node-echo-witness-runner.mjs';
import { runEchoWitness } from './ports/echo-witness-runner.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const DEFAULT_CYCLE_LIMIT = '4';

function main() {
  const options = parseArgs(process.argv.slice(2), process.env);
  if (options.help) {
    process.stdout.write(helpText());
    return 0;
  }

  const adapter = createNodeEchoWitnessRunnerAdapter({
    env: process.env,
    nodePath: process.execPath,
    repoRoot: REPO_ROOT,
  });
  const result = runEchoWitness(options, adapter);
  emitSummary(options, result.summary);
  return result.status;
}

function parseArgs(args, env) {
  const options = {
    dryRun: false,
    replay: false,
    json: false,
    help: false,
    echoWarpWasmDir: env.ECHO_WARP_WASM_DIR,
    echoWasmModule: env.ECHO_WASM_MODULE,
    witnessReportPath: env.JEDIT_ECHO_WITNESS_REPORT,
    jeditDir: env.JEDIT_DIR ?? REPO_ROOT,
    cycleLimit: env.JEDIT_ECHO_WITNESS_CYCLE_LIMIT ?? DEFAULT_CYCLE_LIMIT,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--replay') {
      options.replay = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--echo-warp-wasm-dir') {
      const value = nextArg(args, index);
      if (value === undefined) {
        options.errorMessage = `missing value for ${arg}`;
        break;
      }
      options.echoWarpWasmDir = value;
      index += 1;
    } else if (arg === '--echo-wasm-module') {
      const value = nextArg(args, index);
      if (value === undefined) {
        options.errorMessage = `missing value for ${arg}`;
        break;
      }
      options.echoWasmModule = value;
      index += 1;
    } else if (arg === '--jedit-dir') {
      const value = nextArg(args, index);
      if (value === undefined) {
        options.errorMessage = `missing value for ${arg}`;
        break;
      }
      options.jeditDir = value;
      index += 1;
    } else if (arg === '--witness-report') {
      const value = nextArg(args, index);
      if (value === undefined) {
        options.errorMessage = `missing value for ${arg}`;
        break;
      }
      options.witnessReportPath = value;
      index += 1;
    } else if (arg === '--cycle-limit') {
      const value = nextArg(args, index);
      if (value === undefined) {
        options.errorMessage = `missing value for ${arg}`;
        break;
      }
      options.cycleLimit = value;
      index += 1;
    } else {
      options.errorMessage = `unknown argument: ${arg}`;
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

function emitSummary(options, summary) {
  if (options.json) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    return;
  }

  if (!summary.ok) {
    process.stderr.write(`jedit Echo witness failed: ${summary.message}\n`);
    return;
  }

  process.stdout.write(`jedit Echo witness ${summary.dryRun ? 'planned' : 'passed'}\n`);
}

function helpText() {
  return `Usage: node scripts/jedit-echo-witness.mjs [options]

Options:
  --echo-warp-wasm-dir <path>  Path to echo/crates/warp-wasm.
  --echo-wasm-module <path>    Path to pkg/rmg_wasm.js. Defaults under warp-wasm.
  --witness-report <path>      Path for the JSON witness report.
  --jedit-dir <path>           jedit checkout root. Defaults to this repo.
  --cycle-limit <n>            Until-idle cycle limit for the witness.
  --replay                     Include the replay shell result in the summary.
  --json                       Emit machine-readable summary.
  --dry-run                    Validate and print the command plan without running it.
  --help                       Show this help text.
`;
}

process.exitCode = main();
