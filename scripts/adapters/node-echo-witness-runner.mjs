import { accessSync, constants, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export function createNodeEchoWitnessRunnerAdapter({ env, nodePath, repoRoot }) {
  return {
    createPlan(options) {
      return createPlan({ nodePath, options, repoRoot });
    },
    nowMs() {
      return Date.now();
    },
    readWitnessReport(reportPath) {
      return readWitnessReport(reportPath);
    },
    runStep(step, captureOutput) {
      return runStep({ captureOutput, env, step });
    },
  };
}

function createPlan({ nodePath, options, repoRoot }) {
  if (options.errorMessage != null) {
    return { errorMessage: options.errorMessage };
  }
  if (options.echoWarpWasmDir == null || options.echoWarpWasmDir.trim().length === 0) {
    return { errorMessage: 'set ECHO_WARP_WASM_DIR or pass --echo-warp-wasm-dir' };
  }

  const echoWarpWasmDir = path.resolve(options.echoWarpWasmDir);
  const jeditDir = path.resolve(options.jeditDir ?? repoRoot);
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

  const steps = [
    echoWasmBuildStep({ echoRepoRoot, echoWarpWasmDir, echoWasmBuildScript }),
    jeditBuildStep(jeditDir),
    realWitnessStep({ cycleLimit: options.cycleLimit, echoWasmModule, jeditDir, nodePath, witnessReportPath }),
  ];

  return {
    echoWarpWasmDir,
    echoWasmModule,
    witnessReportPath,
    steps,
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

function echoWasmBuildStep({ echoRepoRoot, echoWarpWasmDir, echoWasmBuildScript }) {
  return commandStep({
    name: 'build-echo-wasm',
    command: echoWasmBuildScript,
    args: [],
    cwd: echoRepoRoot,
    env: { WARP_WASM_DIR: echoWarpWasmDir },
  });
}

function jeditBuildStep(jeditDir) {
  return commandStep({
    name: 'build-jedit',
    command: 'npm',
    args: ['run', 'build'],
    cwd: jeditDir,
    env: {},
  });
}

function realWitnessStep({ cycleLimit, echoWasmModule, jeditDir, nodePath, witnessReportPath }) {
  return commandStep({
    name: 'run-real-echo-witness',
    command: nodePath,
    args: ['--test', 'spec/jedit-echo-wasm-stack-witness.spec.mjs'],
    cwd: jeditDir,
    env: {
      JEDIT_ECHO_WASM_MODULE: echoWasmModule,
      JEDIT_ECHO_WITNESS_REPORT: witnessReportPath,
      JEDIT_ECHO_WITNESS_CYCLE_LIMIT: cycleLimit,
    },
  });
}

function commandStep(step) {
  return {
    ...step,
    commandLine: [step.command, ...step.args].join(' '),
  };
}

function runStep({ captureOutput, env, step }) {
  const startedAt = Date.now();
  const result = spawnSync(step.command, step.args, {
    cwd: step.cwd,
    env: { ...env, ...step.env },
    encoding: captureOutput ? 'utf8' : undefined,
    stdio: captureOutput ? 'pipe' : 'inherit',
  });

  const summary = {
    name: step.name,
    command: step.commandLine,
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

function readWitnessReport(reportPath) {
  if (!existsSync(reportPath)) {
    return undefined;
  }
  return JSON.parse(readFileSync(reportPath, 'utf8'));
}
