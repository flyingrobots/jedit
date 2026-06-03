import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const SPEC_EXTENSION = '.spec.mjs';
const SPEC_ROOTS = Object.freeze(['spec', 'tests']);
const PATH_SEPARATOR_PATTERN = /\\/g;
const CONTRACT_SPEC_PATTERNS = Object.freeze([
  'anchor',
  'codec',
  'contract',
  'eint',
  'edit-group',
  'mutation-envelope',
  'observer',
  'op-ids',
  'optic',
  'replace-range',
  'rope',
  'save-checkpoint',
  'structural-history',
  'tick-admission',
]);
const DOCS_SPEC_PATTERNS = Object.freeze([
  'codegen-docs',
  'docs',
  'guide',
  'quickstart',
  'release-gate-script',
  'release-quickstart',
]);
const ECHO_SPEC_PATTERNS = Object.freeze([
  'echo',
  'hot-buffer',
  'hot-text',
  'installed-jedit',
  'jedit-',
  'production',
  'recovered',
  'recovery',
  'restart',
  'retained',
  'text-runtime',
  'trusted',
  'wsc',
]);
const TITLE_SPEC_PATTERNS = Object.freeze([
  'theme',
  'title',
]);
const WORKSPACE_SPEC_PATTERNS = Object.freeze([
  'drawer',
  'editor',
  'feedback',
  'footer',
  'help',
  'keybinding',
  'keybindings',
  'markdown',
  'mouse',
  'panel',
  'settings',
  'source-highlight',
  'source-window',
  'workspace',
]);

export const TEST_SHARDS = Object.freeze({
  Contracts: 'contracts',
  DocsRelease: 'docs-release',
  EchoAuthority: 'echo-authority',
  MiscFast: 'misc-fast',
  TitleRendering: 'title-rendering',
  WorkspaceUi: 'workspace-ui',
});

export const TEST_SHARD_NAMES = Object.freeze([
  TEST_SHARDS.Contracts,
  TEST_SHARDS.DocsRelease,
  TEST_SHARDS.EchoAuthority,
  TEST_SHARDS.MiscFast,
  TEST_SHARDS.TitleRendering,
  TEST_SHARDS.WorkspaceUi,
]);

export function discoverSpecFiles(rootDirectory = process.cwd()) {
  return SPEC_ROOTS.flatMap((root) => discoverSpecsInDirectory(path.join(rootDirectory, root), rootDirectory))
    .sort(compareRepoPaths);
}

export function specsForShard(shardName, rootDirectory = process.cwd()) {
  assertKnownShard(shardName);
  return discoverSpecFiles(rootDirectory).filter((specPath) => testShardForSpec(specPath) === shardName);
}

export function specsByShard(rootDirectory = process.cwd()) {
  const grouped = new Map(TEST_SHARD_NAMES.map((shardName) => [shardName, []]));
  for (const specPath of discoverSpecFiles(rootDirectory)) {
    grouped.get(testShardForSpec(specPath)).push(specPath);
  }
  return grouped;
}

export function testShardForSpec(filePath) {
  const repoPath = normalizeRepoPath(filePath);
  const name = path.basename(repoPath).toLowerCase();
  if (includesAny(name, TITLE_SPEC_PATTERNS)) {
    return TEST_SHARDS.TitleRendering;
  }
  if (includesAny(name, DOCS_SPEC_PATTERNS)) {
    return TEST_SHARDS.DocsRelease;
  }
  if (repoPath.startsWith('tests/') || includesAny(name, CONTRACT_SPEC_PATTERNS)) {
    return TEST_SHARDS.Contracts;
  }
  if (includesAny(name, ECHO_SPEC_PATTERNS)) {
    return TEST_SHARDS.EchoAuthority;
  }
  if (includesAny(name, WORKSPACE_SPEC_PATTERNS)) {
    return TEST_SHARDS.WorkspaceUi;
  }
  return TEST_SHARDS.MiscFast;
}

export function assertKnownShard(shardName) {
  if (!TEST_SHARD_NAMES.includes(shardName)) {
    throw new UnknownTestShardError(shardName);
  }
}

export function normalizeRepoPath(filePath) {
  return filePath.replace(PATH_SEPARATOR_PATTERN, '/').replace(/^\.\//, '');
}

function discoverSpecsInDirectory(directoryPath, rootDirectory) {
  if (!directoryExists(directoryPath)) {
    return [];
  }
  const entries = readdirSync(directoryPath, { withFileTypes: true });
  const specs = [];
  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      specs.push(...discoverSpecsInDirectory(entryPath, rootDirectory));
    } else if (entry.isFile() && entry.name.endsWith(SPEC_EXTENSION)) {
      specs.push(normalizeRepoPath(path.relative(rootDirectory, entryPath)));
    }
  }
  return specs;
}

function directoryExists(directoryPath) {
  try {
    return statSync(directoryPath).isDirectory();
  } catch {
    return false;
  }
}

function includesAny(value, patterns) {
  return patterns.some((pattern) => value.includes(pattern));
}

function compareRepoPaths(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

class UnknownTestShardError extends Error {
  constructor(shardName) {
    super(`unknown test shard: ${shardName}`);
    this.name = 'UnknownTestShardError';
  }
}
