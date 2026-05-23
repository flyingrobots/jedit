import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = process.cwd();
const ADAPTER_MODULE_PATH = path.join(REPO_ROOT, 'dist', 'adapters', 'jedit-echo-witness-mcp-adapter.js');

let adapterPromise;

test('jedit Echo witness MCP adapter delegates dry-run to witness port', async () => {
  const adapterModule = await loadAdapter();
  const calls = [];
  const adapter = adapterModule.createJeditEchoWitnessMcpAdapter({
    witness: fakeWitness(calls),
  });

  const result = await adapter.call(witnessRequest(true));

  assert.equal(result.toolName, adapterModule.JEDIT_ECHO_WITNESS_MCP_TOOL_NAME);
  assert.equal(result.structuredContent.ok, true);
  assert.equal(result.structuredContent.dryRun, true);
  assert.deepEqual(calls, ['dryRun']);
});

test('jedit Echo witness MCP adapter delegates real call to witness port', async () => {
  const adapterModule = await loadAdapter();
  const calls = [];
  const adapter = adapterModule.createJeditEchoWitnessMcpAdapter({
    witness: fakeWitness(calls),
  });

  const result = await adapter.call(witnessRequest(false));

  assert.equal(result.structuredContent.ok, true);
  assert.equal(result.structuredContent.dryRun, false);
  assert.equal(result.structuredContent.report.outcome.status, 'APPLIED');
  assert.deepEqual(calls, ['run']);
});

test('jedit Echo witness MCP adapter exposes no trusted lifecycle authority', async () => {
  const adapterModule = await loadAdapter();
  const adapter = adapterModule.createJeditEchoWitnessMcpAdapter({
    witness: fakeWitness([]),
  });

  assert.equal('tick' in adapter, false);
  assert.equal('start' in adapter, false);
  assert.equal('stop' in adapter, false);
  assert.equal('requestRunUntilIdle' in adapter, false);
});

function witnessRequest(dryRun) {
  return {
    dryRun,
    bufferKey: 'agent.md',
    insertText: 'hello',
    cycleLimit: 3,
  };
}

function fakeWitness(calls) {
  return {
    async dryRun(request) {
      calls.push('dryRun');
      return {
        ok: true,
        schemaVersion: 1,
        transport: 'installed-jedit-contract',
        dryRun: true,
        install: installSummary(),
        plan: {
          bufferKey: request.bufferKey,
          cycleLimit: request.cycleLimit,
          submitIntent: true,
          trustedHostDrainsRuntime: true,
          appCanTick: false,
        },
        replay: replayPosture(),
      };
    },
    async run() {
      calls.push('run');
      return {
        ok: true,
        schemaVersion: 1,
        transport: 'installed-jedit-contract',
        dryRun: false,
        install: installSummary(),
        report: {
          bufferId: 'buffer-1',
          bufferKey: 'agent.md',
          outcome: {
            status: 'APPLIED',
            intent: {
              kind: 'jedit-intent-handle',
              operationName: 'replaceRangeAsTick',
              submissionId: 'submission-1',
            },
            receipt: {
              kind: 'jedit-receipt-handle',
              receiptId: 'receipt-1',
            },
          },
          outcomeTrail: [],
          retainedEvidence: {
            refs: [],
          },
          receiptId: 'receipt-1',
          readingId: 'reading-1',
          text: 'hello',
          lines: [],
          truncated: false,
        },
        reading: {
          readingId: 'reading-1',
          lineCount: 1,
          truncated: false,
        },
        replay: replayPosture(),
      };
    },
  };
}

function installSummary() {
  return {
    packageId: 'jedit.hot-text-runtime',
    version: '0.1.0-release-gate',
    schemaId: 'contracts/jedit/hot-text-runtime.graphql',
    artifactId: 'src/generated/jedit/hot-text-runtime.wesley.generated.ts',
    codecId: 'jedit-hot-text-runtime-json-v1',
  };
}

function replayPosture() {
  return {
    status: 'UNAVAILABLE',
    reason: 'not part of this adapter test',
  };
}

async function loadAdapter() {
  if (adapterPromise) {
    return adapterPromise;
  }

  adapterPromise = (async () => {
    const build = spawnSync('npm', ['run', '--silent', 'build'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });

    assert.equal(build.status, 0, build.stderr || build.stdout);
    return import(pathToFileURL(ADAPTER_MODULE_PATH).href);
  })();

  return adapterPromise;
}
