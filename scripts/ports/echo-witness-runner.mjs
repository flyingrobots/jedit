export function runEchoWitness(options, adapter) {
  const startedAt = adapter.nowMs();
  const plan = adapter.createPlan(options);

  if (plan.errorMessage != null) {
    return {
      status: 1,
      summary: {
        ok: false,
        dryRun: options.dryRun,
        message: plan.errorMessage,
        echoWarpWasmDir: options.echoWarpWasmDir,
        echoWasmModule: options.echoWasmModule,
        witnessReportPath: options.witnessReportPath,
        steps: [],
        durationMs: adapter.nowMs() - startedAt,
      },
    };
  }

  if (options.dryRun) {
    return {
      status: 0,
      summary: {
        ok: true,
        dryRun: true,
        echoWarpWasmDir: plan.echoWarpWasmDir,
        echoWasmModule: plan.echoWasmModule,
        witnessReportPath: plan.witnessReportPath,
        steps: plan.steps.map(dryRunStep),
        durationMs: adapter.nowMs() - startedAt,
      },
    };
  }

  return runPlannedEchoWitness({ adapter, options, plan, startedAt });
}

function runPlannedEchoWitness({ adapter, options, plan, startedAt }) {
  const steps = [];

  for (const step of plan.steps) {
    const result = adapter.runStep(step, options.json);
    steps.push(result);
    if (result.status !== 0) {
      return {
        status: result.status,
        summary: {
          ok: false,
          dryRun: false,
          message: `${step.name} failed with status ${result.status}`,
          echoWarpWasmDir: plan.echoWarpWasmDir,
          echoWasmModule: plan.echoWasmModule,
          witnessReportPath: plan.witnessReportPath,
          steps,
          durationMs: adapter.nowMs() - startedAt,
        },
      };
    }
  }

  const witnessReportResult = readWitnessReport(adapter, plan.witnessReportPath);
  if (!witnessReportResult.ok) {
    return {
      status: 1,
      summary: {
        ok: false,
        dryRun: false,
        message: 'failed to read witness report',
        echoWarpWasmDir: plan.echoWarpWasmDir,
        echoWasmModule: plan.echoWasmModule,
        witnessReportPath: plan.witnessReportPath,
        witnessReport: null,
        witnessReportError: witnessReportResult.errorMessage,
        steps,
        durationMs: adapter.nowMs() - startedAt,
      },
    };
  }

  return {
    status: 0,
    summary: {
      ok: true,
      dryRun: false,
      echoWarpWasmDir: plan.echoWarpWasmDir,
      echoWasmModule: plan.echoWasmModule,
      witnessReportPath: plan.witnessReportPath,
      witnessReport: witnessReportResult.report,
      steps,
      durationMs: adapter.nowMs() - startedAt,
    },
  };
}

function readWitnessReport(adapter, witnessReportPath) {
  try {
    return {
      ok: true,
      report: adapter.readWitnessReport(witnessReportPath),
    };
  } catch (error) {
    return {
      ok: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

function dryRunStep(step) {
  return {
    name: step.name,
    command: step.commandLine,
    status: 'dry-run',
    durationMs: 0,
  };
}
