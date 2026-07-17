#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';

const OPTION_SAMPLE_FORBIDDEN_FILE = '--sample-forbidden-file';
const SOURCE_ROOT = 'src';
const SOURCE_EXTENSION = '.ts';
const NATIVE_HOST_SOURCE_ROOT = 'native/jedit-echo-host/src';
const RUST_SOURCE_EXTENSION = '.rs';
const SCRIPT_ROOT = 'scripts';
const SCRIPT_EXTENSION = '.mjs';
const GUARD_FILE = 'scripts/jedit-production-cutover-guard.mjs';
const FORBIDDEN_PRODUCT_FILE_NAME = /(?:^|\/)(?:[^/]*(?:fake|fixture|in-memory)[^/]*)\.(?:ts|mjs)$/iu;
const PRODUCTION_FILE = Object.freeze({
  TEXT_RUNTIME_PROFILE: 'src/app/text-runtime-profile.ts',
  TEXT_SESSION: 'src/app/workspace/production-text-session.ts',
  FILE_TREE: 'src/app/workspace/file-tree.ts',
  VIEWER_CONTENT: 'src/app/workspace/viewer-content.ts',
  TEXT_AUTHORITY: 'src/app/workspace/workspace-text-authority.ts',
  TEXT_COMMANDS: 'src/app/workspace/workspace-text-commands.ts',
  TEXT_POSITION: 'src/app/workspace/workspace-text-position.ts',
  TEXT_RESULTS: 'src/app/workspace/workspace-text-results.ts',
  TEXT_RUNTIME_PROFILE_SESSION: 'src/adapters/workspace-production-text-session.ts',
});
const LIFECYCLE_AUTHORITY_FILE = Object.freeze({
  FILE_TREE: PRODUCTION_FILE.FILE_TREE,
  GLOBAL_KEY_BINDINGS: 'src/app/workspace/global-key-bindings.ts',
  KEY_BINDINGS: 'src/app/workspace/key-bindings.ts',
  RUNTIME: 'src/app/workspace/runtime.ts',
  VIEWER_CONTENT: PRODUCTION_FILE.VIEWER_CONTENT,
  VIEWER_KEY: 'src/app/workspace/viewer-key.ts',
  TEXT_AUTHORITY: PRODUCTION_FILE.TEXT_AUTHORITY,
  TEXT_COMMANDS: PRODUCTION_FILE.TEXT_COMMANDS,
  TEXT_EDIT_PLANNER: 'src/app/workspace/workspace-text-edit-planner.ts',
  TEXT_POSITION: PRODUCTION_FILE.TEXT_POSITION,
  TEXT_READING_CACHE: 'src/app/workspace/workspace-text-reading-cache.ts',
  TEXT_RESULTS: PRODUCTION_FILE.TEXT_RESULTS,
  TEXT_RUNTIME_STATE: 'src/app/workspace/workspace-text-runtime-state.ts',
  WORKSPACE_SAVE_KEY: 'src/app/workspace/workspace-save-key.ts',
});
const TRANSITIONAL_FILE = Object.freeze({
  INTERACTIVE_TEXT_RUNTIME_MODE: 'src/app/interactive-text-runtime-mode.ts',
  INTERACTIVE_ECHO_TEXT_SESSION: 'src/adapters/interactive-echo-text-session.ts',
});
const DEFAULT_PRODUCTION_FILES = Object.freeze([
  PRODUCTION_FILE.TEXT_RUNTIME_PROFILE,
  PRODUCTION_FILE.TEXT_SESSION,
  PRODUCTION_FILE.FILE_TREE,
  PRODUCTION_FILE.VIEWER_CONTENT,
  PRODUCTION_FILE.TEXT_AUTHORITY,
  PRODUCTION_FILE.TEXT_COMMANDS,
  PRODUCTION_FILE.TEXT_POSITION,
  PRODUCTION_FILE.TEXT_RESULTS,
  PRODUCTION_FILE.TEXT_RUNTIME_PROFILE_SESSION,
]);
const DEFAULT_LIFECYCLE_AUTHORITY_FILES = Object.freeze([
  LIFECYCLE_AUTHORITY_FILE.FILE_TREE,
  LIFECYCLE_AUTHORITY_FILE.GLOBAL_KEY_BINDINGS,
  LIFECYCLE_AUTHORITY_FILE.KEY_BINDINGS,
  LIFECYCLE_AUTHORITY_FILE.RUNTIME,
  LIFECYCLE_AUTHORITY_FILE.VIEWER_CONTENT,
  LIFECYCLE_AUTHORITY_FILE.VIEWER_KEY,
  LIFECYCLE_AUTHORITY_FILE.TEXT_EDIT_PLANNER,
  LIFECYCLE_AUTHORITY_FILE.WORKSPACE_SAVE_KEY,
  LIFECYCLE_AUTHORITY_FILE.TEXT_AUTHORITY,
  LIFECYCLE_AUTHORITY_FILE.TEXT_COMMANDS,
  LIFECYCLE_AUTHORITY_FILE.TEXT_POSITION,
  LIFECYCLE_AUTHORITY_FILE.TEXT_READING_CACHE,
  LIFECYCLE_AUTHORITY_FILE.TEXT_RESULTS,
  LIFECYCLE_AUTHORITY_FILE.TEXT_RUNTIME_STATE,
]);
const REMOVED_TRANSITIONAL_FILES = Object.freeze([
  'src/domain/text-edit-contract.ts',
  'src/domain/tick-admission-contract.ts',
  'src/domain/edit-group-contract.ts',
  'src/domain/save-checkpoint-contract.ts',
  'src/app/jedit-contract-runtime-id.ts',
  'src/app/jedit-hot-text-json-schemas.ts',
  'src/app/workspace/production-text-session-witness.ts',
  'src/app/workspace/echo-history.ts',
  'src/app/workspace/production-text-coordinate-serialization.ts',
  'src/app/workspace/production-text-window-projection.ts',
  'src/app/workspace/workspace-text-operation-sequencer.ts',
  'src/app/workspace/worldline-command-dispatch.ts',
  'src/app/workspace/worldline-commands.ts',
  'src/app/workspace/worldline-graph.ts',
  'src/app/workspace/worldline-phase-view.ts',
  'src/app/workspace/worldline-state.ts',
  'src/app/workspace/worldline-types.ts',
  'src/codec.ts',
  'src/ports/jedit-agent-strand-contract.ts',
  'src/generated/jedit/rope.wesley.generated.ts',
  'scripts/gen-structural-history-wesley.mjs',
  'scripts/run-wesley-cli.mjs',
  'src/adapters/echo-wasm-kernel.ts',
  'src/ports/echo-kernel-transport.ts',
  'scripts/jedit-echo-kernel-smoke.mjs',
  'scripts/run-real-echo-wasm-stack-witness.sh',
  TRANSITIONAL_FILE.INTERACTIVE_TEXT_RUNTIME_MODE,
  TRANSITIONAL_FILE.INTERACTIVE_ECHO_TEXT_SESSION,
  'src/adapters/fake-echo-jedit-optic-transport.ts',
  'src/adapters/full-snapshot-hot-text-runtime-fixture.ts',
  'src/adapters/graph-rope-hot-text-authority-adapter.ts',
  'src/adapters/installed-jedit-contract-echo-transport.ts',
  'src/adapters/installed-jedit-eint-bridge.ts',
  'src/app/jedit-contract-runtime.ts',
  'src/app/jedit-contract-mutation-handlers.ts',
  'src/app/jedit-contract-query-observers.ts',
  'src/app/jedit-edit-submission-identity.ts',
  'src/app/jedit-recovery-gate-scenario.ts',
  'src/app/jedit-submission-ledger.ts',
  'src/app/jedit-ticketed-work-boundary.ts',
  'src/app/trusted-echo-runtime-loop.ts',
  'src/app/workspace/workspace-production-optimistic-edit.ts',
  'src/app/workspace/workspace-text-wsc-settlement.ts',
  'src/adapters/jedit-wsc-workspace-store.ts',
  'src/domain/graph-rope-runtime.ts',
  'src/ports/text-buffer-session.ts',
  'src/generated/jedit/rope.codec.generated.ts',
  'scripts/jedit-workspace-echo-witness.mjs',
]);
const FORBIDDEN_LEGACY_AUTHORITY_PATTERNS = Object.freeze([
  { label: 'loadEditor', pattern: /\bloadEditor\b(?!File)/u },
  { label: 'saveEditor', pattern: /\bsaveEditor\b(?!File)/u },
  { label: 'updateInsertMode', pattern: /\bupdateInsertMode\b/u },
  { label: 'updateNormalMode', pattern: /\bupdateNormalMode\b/u },
  { label: 'editor.lines', pattern: /\beditor\.lines\b/u },
]);
const FORBIDDEN_LIFECYCLE_AUTHORITY_PATTERNS = Object.freeze([
  { label: 'requestStart', pattern: /\brequestStart\b/u },
  { label: 'requestRunUntilIdle', pattern: /\brequestRunUntilIdle\b/u },
  { label: 'requestStop', pattern: /\brequestStop\b/u },
  { label: 'tick', pattern: /\btick\s*\(/u },
  { label: 'interactiveTextRuntimeMode', pattern: /\binteractiveTextRuntimeMode\b/u },
  { label: 'InteractiveTextRuntimeMode', pattern: /\bInteractiveTextRuntimeMode\b/u },
  { label: 'INTERACTIVE_TEXT_RUNTIME', pattern: /\bINTERACTIVE_TEXT_RUNTIME\b/u },
]);
const FORBIDDEN_RECOVERY_FALLBACK_PATTERNS = Object.freeze([
  { label: 'createInMemoryHotTextRuntime', pattern: /\bcreateInMemoryHotTextRuntime\b/u },
  { label: 'in-memory-hot-text-runtime', pattern: /\bin-memory-hot-text-runtime\b/u },
  { label: 'createFullSnapshotHotTextRuntimeFixture', pattern: /\bcreateFullSnapshotHotTextRuntimeFixture\b/u },
  { label: 'full-snapshot-hot-text-runtime-fixture', pattern: /\bfull-snapshot-hot-text-runtime-fixture\b/u },
  { label: 'createTextBufferSession', pattern: /\bcreateTextBufferSession\b/u },
  { label: 'HotTextBufferState', pattern: /\bHotTextBufferState\b/u },
  { label: 'getCurrentText', pattern: /\bgetCurrentText\b/u },
  { label: 'readLocalText', pattern: /\breadLocalText\b/u },
  { label: 'currentBuffer', pattern: /\bcurrentBuffer\b/u },
  { label: 'saveFromBuffer', pattern: /\bsaveFromBuffer\b/u },
]);
const FORBIDDEN_NON_ECHO_RUNTIME_MODE_PATTERNS = Object.freeze([
  { label: 'TEXT_RUNTIME_PROFILE_TEST_LOCAL', pattern: /\bTEXT_RUNTIME_PROFILE_TEST_LOCAL\b/u },
  { label: 'testLocal profile', pattern: /\btestLocal\b/u },
  { label: 'testLocalSessionFactory', pattern: /\btestLocalSessionFactory\b/u },
  { label: 'defaultTestLocalSessionFactory', pattern: /\bdefaultTestLocalSessionFactory\b/u },
  { label: 'fallbackProfile', pattern: /\bfallbackProfile\b/u },
]);
const FORBIDDEN_PRODUCT_FIXTURE_AUTHORITY_PATTERNS = Object.freeze([
  { label: 'createInMemory production implementation', pattern: /\bcreateInMemory[A-Za-z0-9_]*\b/u },
  { label: 'createFake production implementation', pattern: /\bcreateFake[A-Za-z0-9_]*\b/u },
  { label: 'createFullSnapshotHotTextRuntimeFixture', pattern: /\bcreateFullSnapshotHotTextRuntimeFixture\b/u },
  { label: 'isFullSnapshotHotTextRuntimeFixture', pattern: /\bisFullSnapshotHotTextRuntimeFixture\b/u },
  { label: 'FullSnapshotHotTextRuntimeFixture', pattern: /\bFullSnapshotHotTextRuntimeFixture\b/u },
  { label: 'full-snapshot-hot-text-runtime-fixture', pattern: /\bfull-snapshot-hot-text-runtime-fixture\b/u },
  { label: 'createInMemoryHotTextRuntime', pattern: /\bcreateInMemoryHotTextRuntime\b/u },
  { label: 'in-memory-hot-text-runtime', pattern: /\bin-memory-hot-text-runtime\b/u },
  { label: 'createFakeEchoJeditOpticTransport', pattern: /\bcreateFakeEchoJeditOpticTransport\b/u },
  { label: 'fake-echo-jedit-optic-transport', pattern: /\bfake-echo-jedit-optic-transport\b/u },
  { label: 'Jim-owned Echo admission ticket', pattern: /\b(?:OpticAdmissionTicket|OPTIC_ADMISSION_TICKET_KIND)\b/u },
  { label: 'caller-ticket installed-contract staging', pattern: /\bstage_installed_contract_submission\b/u },
  { label: 'compatibility admission authority', pattern: /\bcompatibility_admission[A-Za-z0-9_]*\b/u },
  { label: 'raw Echo WASM transport', pattern: /\bcreateEchoWasmKernel(?:Host)?Transport\b|\becho-wasm-kernel\b/u },
  { label: 'retired Echo WASM module override', pattern: /\bJEDIT_ECHO_WASM_MODULE\b/u },
  { label: 'createInstalledJeditContractEchoTransport', pattern: /\bcreateInstalledJeditContractEchoTransport\b/u },
  { label: 'installed-jedit-contract-echo-transport', pattern: /\binstalled-jedit-contract-echo-transport\b/u },
  { label: 'createGraphRopeHotTextAuthority', pattern: /\bcreateGraphRopeHotTextAuthority\b/u },
  { label: 'createGraphRopeRuntime', pattern: /\bcreateGraphRopeRuntime\b/u },
  { label: 'local production text session adapter', pattern: /\bcreateProductionTextSession\b/u },
  { label: 'handwritten rope EINT codec', pattern: /\brope\.codec\.generated\b/u },
  { label: 'handwritten EINT intent packer', pattern: /\bpackIntentV1\b/u },
  { label: 'local contract package descriptor', pattern: /\bjeditHotTextContractPackage\b/u },
  { label: 'local runtime work envelope', pattern: /\bcreateJeditRuntimeWorkEnvelope\b/u },
  { label: 'local ticketed work', pattern: /\bcreateJeditTicketed(?:RuntimeIngress|WorkBoundary)\b/u },
  { label: 'local submission ledger', pattern: /\bcreateJeditSubmissionLedger\b/u },
  { label: 'local receipt correlation', pattern: /\bcreateJeditReceiptCorrelation\b/u },
  { label: 'process-local receipt correlation map', pattern: /\beditReceipts\b/u },
  { label: 'local WSC authority', pattern: /\b(?:JeditWsc|jedit-wsc|echo-wsc)\b/u },
  { label: 'legacy local editor load', pattern: /\bloadEditor\b(?!File)/u },
  { label: 'legacy local editor save', pattern: /\bsaveEditor\b(?!File)/u },
  { label: 'local trusted runtime loop', pattern: /\bcreateTrustedEchoRuntimeLoop\b/u },
  { label: 'HotTextRuntimePort', pattern: /\bHotTextRuntimePort\b/u },
  { label: 'HotTextBufferState', pattern: /\bHotTextBufferState\b/u },
  { label: 'handwritten text session port', pattern: /\bTextBufferSessionPort\b/u },
  { label: 'handwritten text optic mutation', pattern: /\bTextBufferOptic\b|\bapplyIntent\b/u },
  { label: 'process-local editor undo stack', pattern: /\bundoStack\b/u },
  { label: 'process-local editor redo stack', pattern: /\bredoStack\b/u },
  { label: 'startHotBufferSession', pattern: /\bstartHotBufferSession\b/u },
  { label: 'materializeHotBuffer', pattern: /\bmaterializeHotBuffer\b/u },
  { label: 'hot-buffer-session', pattern: /\bhot-buffer-session\b/u },
  { label: 'HotTextBufferState.roots', pattern: /\bHotTextBufferState\.roots\b/u },
  { label: 'editor line array save', pattern: /\bsave(?:Editor|Workspace)?Lines\b/u },
  { label: 'Git diff modified lines', pattern: /\bgitDiffModifiedLines\b/u },
]);

const options = parseArgs(process.argv.slice(2));
const guardedProductFiles = productAuthoritySourceFiles();
const failures = [
  ...removedFileFailures(),
  ...forbiddenProductFileNameFailures([
    ...guardedProductFiles,
    ...options.sampleForbiddenFiles,
  ]),
  ...forbiddenSourceFailures(guardedProductFiles, FORBIDDEN_PRODUCT_FIXTURE_AUTHORITY_PATTERNS),
  ...forbiddenSourceFailures(DEFAULT_PRODUCTION_FILES, FORBIDDEN_LEGACY_AUTHORITY_PATTERNS),
  ...forbiddenSourceFailures(DEFAULT_PRODUCTION_FILES, FORBIDDEN_NON_ECHO_RUNTIME_MODE_PATTERNS),
  ...forbiddenSourceFailures(DEFAULT_LIFECYCLE_AUTHORITY_FILES, FORBIDDEN_LIFECYCLE_AUTHORITY_PATTERNS),
  ...forbiddenSourceFailures(options.sampleForbiddenFiles, [
    ...FORBIDDEN_LEGACY_AUTHORITY_PATTERNS,
    ...FORBIDDEN_NON_ECHO_RUNTIME_MODE_PATTERNS,
    ...FORBIDDEN_LIFECYCLE_AUTHORITY_PATTERNS,
    ...FORBIDDEN_RECOVERY_FALLBACK_PATTERNS,
    ...FORBIDDEN_PRODUCT_FIXTURE_AUTHORITY_PATTERNS,
  ]),
];

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('jedit production cutover guard ok\n');
}

function parseArgs(args) {
  const options = {
    sampleForbiddenFiles: [],
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === OPTION_SAMPLE_FORBIDDEN_FILE) {
      options.sampleForbiddenFiles.push(requiredValue(args, index, arg));
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

function removedFileFailures() {
  return REMOVED_TRANSITIONAL_FILES.flatMap((filePath) => {
    try {
      readFileSync(filePath, 'utf8');
      return [`removed transitional file still exists: ${filePath}`];
    } catch {
      return [];
    }
  });
}

function productSourceFiles() {
  return [
    ...collectProductFiles(SOURCE_ROOT, SOURCE_EXTENSION),
    ...collectProductFiles(SCRIPT_ROOT, SCRIPT_EXTENSION).filter(filePath => filePath !== GUARD_FILE),
  ];
}

function productAuthoritySourceFiles() {
  return [
    ...productSourceFiles(),
    ...collectProductFiles(NATIVE_HOST_SOURCE_ROOT, RUST_SOURCE_EXTENSION),
  ];
}

function forbiddenProductFileNameFailures(filePaths) {
  return filePaths
    .filter((filePath) => FORBIDDEN_PRODUCT_FILE_NAME.test(filePath))
    .map((filePath) => `${filePath}: test-only implementation filename is forbidden in production source`);
}

function collectProductFiles(root, extension) {
  const entries = readdirSync(root).sort();
  return entries.flatMap((entry) => {
    const entryPath = `${root}/${entry}`;
    const stat = statSync(entryPath);
    if (stat.isDirectory()) {
      return collectProductFiles(entryPath, extension);
    }
    return entryPath.endsWith(extension) ? [entryPath] : [];
  });
}

function forbiddenSourceFailures(filePaths, forbiddenPatterns) {
  return filePaths.flatMap((filePath) => forbiddenSourceFileFailures(filePath, forbiddenPatterns));
}

function forbiddenSourceFileFailures(filePath, forbiddenPatterns) {
  let source;
  try {
    source = readFileSync(filePath, 'utf8');
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return [`${filePath}: missing guarded production cutover file: ${message}`];
  }
  return forbiddenPatterns
    .filter((entry) => entry.pattern.test(source))
    .map((entry) => `${filePath}: forbidden production cutover token: ${entry.label}`);
}
