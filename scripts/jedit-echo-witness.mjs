#!/usr/bin/env node
import { accessSync, constants, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const DEFAULT_CYCLE_LIMIT = '4';

function main() {
  const options = parseArgs(process.argv.slice(2), process.env);
  const startedAt = Date.now();
  const plan = createPlan(options);

  if (options.help) {
    process.stdout.write(helpText());
    return 0;
  }

  if (plan.errorMessage != null) {
    emitSummary(options, {
      ok: false,
      dryRun: options.dryRun,
      message: plan.errorMessage,
      echoWarpWasmDir: options.echoWarpWasmDir,
      echoWasmModule: options.echoWasmModule,
      witnessReportPath: options.witnessReportPath,
      steps: [],
      durationMs: Date.now() - startedAt,
    });
    return 1;
  }

  if (options.dryRun) {
    emitSummary(options, {
      ok: true,
      dryRun: true,
      echoWarpWasmDir: plan.echoWarpWasmDir,
      echoWasmModule: plan.echoWasmModule,
      witnessReportPath: plan.witnessReportPath,
      steps: plan.steps.map(dryRunStep),
      durationMs: Date.now() - startedAt,
    });
    return 0;
  }

  const steps = [];
  for (const step of plan.steps) {
    const result = runStep(step, options.json);
    steps.push(result);
    if (result.status !== 0) {
      emitSummary(options, {
        ok: false,
        dryRun: false,
        message: `${step.name} failed with status ${result.status}`,
        echoWarpWasmDir: plan.echoWarpWasmDir,
        echoWasmModule: plan.echoWasmModule,
        witnessReportPath: plan.witnessReportPath,
        steps,
        durationMs: Date.now() - startedAt,
      });
      return result.status;
    }
  }

  emitSummary(options, {
    ok: true,
    dryRun: false,
    echoWarpWasmDir: plan.echoWarpWasmDir,
    echoWasmModule: plan.echoWasmModule,
    witnessReportPath: plan.witnessReportPath,
    witnessReport: readWitnessReport(plan.witnessReportPath),
    steps,
    durationMs: Date.now() - startedAt,
  });
  return 0;
}

function parseArgs(args, env) {
  const options = {
    dryRun: false,
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
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--echo-warp-wasm-dir') {
      options.echoWarpWasmDir = nextArg(args, index, arg);
      index += 1;
    } else if (arg === '--echo-wasm-module') {
      options.echoWasmModule = nextArg(args, index, arg);
      index += 1;
    } else if (arg === '--jedit-dir') {
      options.jeditDir = nextArg(args, index, arg);
      index += 1;
    } else if (arg === '--witness-report') {
      options.witnessReportPath = nextArg(args, index, arg);
      index += 1;
    } else if (arg === '--cycle-limit') {
      options.cycleLimit = nextArg(args, index, arg);
      index += 1;
    } else {
      options.errorMessage = `unknown argument: ${arg}`;
    }
  }

  return options;
}

function nextArg(args, index, name) {
  const value = args[index + 1];
  if (value == null || value.startsWith('--')) {
    return `missing:${name}`;
  }
  return value;
}

function createPlan(options) {
  if (options.errorMessage != null) {
    return { errorMessage: options.errorMessage };
  }
  if (options.echoWarpWasmDir == null || options.echoWarpWasmDir.trim().length === 0) {
    return { errorMessage: 'set ECHO_WARP_WASM_DIR or pass --echo-warp-wasm-dir' };
  }

  const echoWarpWasmDir = path.resolve(options.echoWarpWasmDir);
  const jeditDir = path.resolve(options.jeditDir);
  const echoRepoRoot = path.resolve(echoWarpWasmDir, '..', '..');
  const echoWasmBuildScript = path.join(echoRepoRoot, 'scripts', 'build-warp-wasm-package.sh');
  const echoWasmModule = path.resolve(options.echoWasmModule ?? path.join(echoWarpWasmDir, 'pkg', 'rmg_wasm.js'));
  const witnessReportPath = path.resolve(
    options.witnessReportPath
      ?? path.join(jeditDir, '.jedit-cache', 'echo-witness', 'stack-witness-report.json'),
  );

  const validationError = validatePlanPaths({ echoWarpWasmDir, echoWasmBuildScript, jeditDir });
  if (validationError != null) {
    return { errorMessage: validationError };
  }

  return {
    echoWarpWasmDir,
    echoWasmModule,
    witnessReportPath,
    steps: [
      {
        name: 'build-echo-wasm',
        command: echoWasmBuildScript,
        args: [],
        cwd: echoRepoRoot,
        env: { WARP_WASM_DIR: echoWarpWasmDir },
      },
      {
        name: 'build-jedit',
        command: 'npm',
        args: ['run', 'build'],
        cwd: jeditDir,
        env: {},
      },
      {
        name: 'run-real-echo-witness',
        command: process.execPath,
        args: ['--test', 'spec/jedit-echo-wasm-stack-witness.spec.mjs'],
        cwd: jeditDir,
        env: {
          JEDIT_ECHO_WASM_MODULE: echoWasmModule,
          JEDIT_ECHO_WITNESS_REPORT: witnessReportPath,
          JEDIT_ECHO_WITNESS_CYCLE_LIMIT: options.cycleLimit,
        },
      },
    ],
  };
}

function validatePlanPaths(paths) {
  const checks = [
    [paths.echoWarpWasmDir, constants.R_OK, 'Echo warp-wasm directory is not readable'],
    [paths.echoWasmBuildScript, constants.X_OK, 'Echo WASM build script is not executable'],
    [paths.jeditDir, constants.R_OK, 'jedit directory is not readable'],
  ];

  for (const [targetPath, mode, message] of checks) {
    try {
      accessSync(targetPath, mode);
    } catch {
      return `${message}: ${targetPath}`;
    }
  }

  return undefined;
}

function runStep(step, captureOutput) {
  const startedAt = Date.now();
  const result = spawnSync(step.command, step.args, {
    cwd: step.cwd,
    env: { ...process.env, ...step.env },
    encoding: captureOutput ? 'utf8' : undefined,
    stdio: captureOutput ? 'pipe' : 'inherit',
  });

  const summary = {
    name: step.name,
    command: commandLine(step),
    status: result.status ?? 1,
    durationMs: Date.now() - startedAt,
  };

  if (captureOutput) {
    return {
      ...summary,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
    };
  }

  return summary;
}

function dryRunStep(step) {
  return {
    name: step.name,
    command: commandLine(step),
    status: 'dry-run',
    durationMs: 0,
  };
}

function readWitnessReport(reportPath) {
  if (!existsSync(reportPath)) {
    return undefined;
  }
  return JSON.parse(readFileSync(reportPath, 'utf8'));
}

function commandLine(step) {
  return [step.command, ...step.args].join(' ');
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
  --json                       Emit machine-readable summary.
  --dry-run                    Validate and print the command plan without running it.
  --help                       Show this help text.
`;
}

process.exitCode = main();
