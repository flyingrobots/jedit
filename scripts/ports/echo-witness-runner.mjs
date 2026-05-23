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
        replayRequested: options.replay,
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

  const replay = options.replay === true
    ? summarizeReplayPosture(witnessReportResult.report)
    : undefined;

  return {
    status: 0,
    summary: {
      ok: true,
      dryRun: false,
      replayRequested: options.replay,
      echoWarpWasmDir: plan.echoWarpWasmDir,
      echoWasmModule: plan.echoWasmModule,
      witnessReportPath: plan.witnessReportPath,
      witnessReport: witnessReportResult.report,
      ...(replay === undefined ? {} : { replay }),
      steps,
      durationMs: adapter.nowMs() - startedAt,
    },
  };
}

function summarizeReplayPosture(report) {
  if (hasValidReplayPosture(report)) {
    return report.replay;
  }

  const reason = hasReplayPosture(report)
    ? 'witness report carries malformed replay posture'
    : 'witness report does not carry a replay proof yet';
  return createReplayUnavailablePosture(report, reason);
}

function hasValidReplayPosture(report) {
  if (!hasReplayPosture(report) || typeof report.replay.status !== 'string') {
    return false;
  }
  if (report.replay.status === 'obstructed' && typeof report.replay.obstruction !== 'string') {
    return false;
  }
  return report.replay.readingIdentity === undefined
    || hasValidReadingIdentity(report.replay.readingIdentity);
}

function hasReplayPosture(report) {
  return report != null && typeof report === 'object'
    && report.replay != null && typeof report.replay === 'object';
}

function hasValidReadingIdentity(readingIdentity) {
  return readingIdentity != null && typeof readingIdentity === 'object'
    && typeof readingIdentity.readingId === 'string'
    && typeof readingIdentity.artifactHash === 'string';
}

function createReplayUnavailablePosture(report, reason) {
  const reading = report != null && typeof report === 'object' ? report.reading : undefined;
  return {
    status: 'obstructed',
    obstruction: 'durable_replay_unavailable',
    reason,
    readingIdentity: {
      readingId: typeof reading?.readingId === 'string' ? reading.readingId : null,
      artifactHash: typeof reading?.artifactHash === 'string' ? reading.artifactHash : null,
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
