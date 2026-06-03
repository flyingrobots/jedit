#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const OPTION_SAMPLE_FORBIDDEN_FILE = '--sample-forbidden-file';
const PRODUCTION_FILE = Object.freeze({
  TEXT_RUNTIME_PROFILE: 'src/app/text-runtime-profile.ts',
  TEXT_SESSION: 'src/app/workspace/production-text-session.ts',
  TEXT_SESSION_WITNESS: 'src/app/workspace/production-text-session-witness.ts',
  FILE_TREE: 'src/app/workspace/file-tree.ts',
  VIEWER_CONTENT: 'src/app/workspace/viewer-content.ts',
  TEXT_AUTHORITY: 'src/app/workspace/workspace-text-authority.ts',
  TEXT_COMMANDS: 'src/app/workspace/workspace-text-commands.ts',
  TEXT_POSITION: 'src/app/workspace/workspace-text-position.ts',
  TEXT_RESULTS: 'src/app/workspace/workspace-text-results.ts',
  TEXT_RUNTIME_PROFILE_SESSION: 'src/adapters/text-runtime-profile-session.ts',
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
const RECOVERY_GATE_FILE = Object.freeze({
  ECHO_CLI_ADAPTER: 'src/adapters/echo-cli-recovery-adapter.ts',
  ECHO_CODEC: 'src/adapters/echo-recovery-codec.ts',
  ECHO_POSTURE: 'src/app/echo-recovery-posture.ts',
  EDIT_SUBMISSION_IDENTITY: 'src/app/jedit-edit-submission-identity.ts',
  RECOVERY_EVIDENCE_REPORT: 'src/app/jedit-recovery-evidence-report.ts',
});
const TRANSITIONAL_FILE = Object.freeze({
  INTERACTIVE_TEXT_RUNTIME_MODE: 'src/app/interactive-text-runtime-mode.ts',
  INTERACTIVE_ECHO_TEXT_SESSION: 'src/adapters/interactive-echo-text-session.ts',
});
const DEFAULT_PRODUCTION_FILES = Object.freeze([
  PRODUCTION_FILE.TEXT_RUNTIME_PROFILE,
  PRODUCTION_FILE.TEXT_SESSION,
  PRODUCTION_FILE.TEXT_SESSION_WITNESS,
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
const DEFAULT_RECOVERY_GATE_FILES = Object.freeze([
  RECOVERY_GATE_FILE.ECHO_CLI_ADAPTER,
  RECOVERY_GATE_FILE.ECHO_CODEC,
  RECOVERY_GATE_FILE.ECHO_POSTURE,
  RECOVERY_GATE_FILE.EDIT_SUBMISSION_IDENTITY,
  RECOVERY_GATE_FILE.RECOVERY_EVIDENCE_REPORT,
]);
const REMOVED_TRANSITIONAL_FILES = Object.freeze([
  TRANSITIONAL_FILE.INTERACTIVE_TEXT_RUNTIME_MODE,
  TRANSITIONAL_FILE.INTERACTIVE_ECHO_TEXT_SESSION,
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

const options = parseArgs(process.argv.slice(2));
const failures = [
  ...removedFileFailures(),
  ...forbiddenSourceFailures(DEFAULT_PRODUCTION_FILES, FORBIDDEN_LEGACY_AUTHORITY_PATTERNS),
  ...forbiddenSourceFailures(DEFAULT_PRODUCTION_FILES, FORBIDDEN_NON_ECHO_RUNTIME_MODE_PATTERNS),
  ...forbiddenSourceFailures(DEFAULT_LIFECYCLE_AUTHORITY_FILES, FORBIDDEN_LIFECYCLE_AUTHORITY_PATTERNS),
  ...forbiddenSourceFailures(DEFAULT_RECOVERY_GATE_FILES, FORBIDDEN_RECOVERY_FALLBACK_PATTERNS),
  ...forbiddenSourceFailures(options.sampleForbiddenFiles, [
    ...FORBIDDEN_LEGACY_AUTHORITY_PATTERNS,
    ...FORBIDDEN_NON_ECHO_RUNTIME_MODE_PATTERNS,
    ...FORBIDDEN_LIFECYCLE_AUTHORITY_PATTERNS,
    ...FORBIDDEN_RECOVERY_FALLBACK_PATTERNS,
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
