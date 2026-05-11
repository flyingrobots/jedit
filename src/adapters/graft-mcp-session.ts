import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative } from 'node:path';
import type { GraftInfo, GraftSessionPort } from '../ports/graft-session.js';

import {
  GraftInvalidPayloadError,
  GraftNoTextContentError,
  GraftPackageNotFoundError,
  GraftToolExecutionError,
} from '../domain/errors.js';

const require = createRequire(import.meta.url);

const GRAFT_PACKAGE_SPECIFIER = '@flyingrobots/graft';
const GRAFT_PACKAGE_JSON_SPECIFIER = '@flyingrobots/graft/package.json';
const GRAFT_BIN_PATH = 'bin/graft.js';
const GRAFT_SERVE_COMMAND = 'serve';
const GRAFT_FILE_OUTLINE_TOOL = 'file_outline';
const GRAFT_DIFF_TOOL = 'graft_diff';
const GRAFT_PROJECTION_REFUSED = 'refused';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | readonly JsonValue[] | JsonObject;

interface JsonObject {
  readonly [key: string]: JsonValue | undefined;
}

export interface GraftOutlineItem {
  readonly kind: string;
  readonly name: string;
  readonly signature?: string;
  readonly startLine: number;
  readonly endLine: number;
}

export interface GraftJumpEntry {
  readonly symbol: string;
  readonly kind: string;
  readonly start: number;
  readonly end: number;
}

interface GraftDiffEntry {
  readonly name: string;
  readonly kind: string;
}

export interface GraftFileOutlineResult {
  readonly jumpTable?: readonly GraftJumpEntry[];
  readonly projection?: string;
  readonly reason?: string;
}

export interface GraftStructDiffResult {
  readonly files: ReadonlyArray<{
    readonly path: string;
    readonly summary: string;
    readonly diff: {
      readonly added: readonly GraftDiffEntry[];
      readonly changed: readonly GraftDiffEntry[];
      readonly removed: readonly GraftDiffEntry[];
    };
  }>;
}

interface GraftMcpConnection {
  readonly workspaceRoot: string;
  readonly client: Client;
  readonly transport: StdioClientTransport;
}

interface GraftTextBlock {
  readonly type: string;
  readonly text?: string;
}

interface GraftCallToolResult {
  readonly isError?: boolean;
  readonly structuredContent?: JsonValue;
  readonly content?: readonly GraftTextBlock[];
}

let graftConnection: GraftMcpConnection | undefined;
let graftConnectionPromise: Promise<GraftMcpConnection> | undefined;
let graftCliPath: string | undefined;

export async function loadGraftInfo(workspaceRoot: string, filePath: string, dirty: boolean): Promise<GraftInfo> {
  const relativePath = relative(workspaceRoot, filePath).replace(/\\/g, '/');
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    return {
      path: filePath,
      relativePath: filePath,
      dirty,
      outlineItems: [],
      changeLines: ['outside workspace root'],
      error: 'Graft only runs against files inside the launch workspace.',
    };
  }

  let outlineItems: readonly GraftOutlineItem[] = [];
  let error: string | undefined;

  try {
    const outline = decodeGraftFileOutlineResult(await callGraftTool(
      workspaceRoot,
      GRAFT_FILE_OUTLINE_TOOL,
      { path: relativePath },
    ));
    if (outline.projection === GRAFT_PROJECTION_REFUSED) {
      error = outline.reason ?? 'outline refused';
    } else {
      outlineItems = (outline.jumpTable ?? []).map((entry) => ({
        kind: entry.kind,
        name: entry.symbol,
        startLine: entry.start,
        endLine: entry.end,
      }));
    }
  } catch (cause) {
    error = `graft outline failed: ${cause instanceof Error ? cause.message : String(cause)}`;
  }

  return {
    path: filePath,
    relativePath,
    dirty,
    outlineItems,
    changeLines: await loadGraftChanges(workspaceRoot, relativePath),
    ...(dirty ? { notice: 'saved file only; unsaved edits are not reflected' } : {}),
    ...(error != null ? { error } : {}),
  };
}

export function failedGraftInfo(
  workspaceRoot: string,
  filePath: string,
  dirty: boolean,
  message: string,
): GraftInfo {
  return {
    path: filePath,
    relativePath: relative(workspaceRoot, filePath).replace(/\\/g, '/'),
    dirty,
    outlineItems: [],
    changeLines: [],
    error: `graft request failed: ${message}`,
    ...(dirty ? { notice: 'saved file only; unsaved edits are not reflected' } : {}),
  };
}

export async function closeGraftConnection(): Promise<void> {
  const connection = graftConnection;
  graftConnection = undefined;
  if (connection == null) {
    return;
  }

  await connection.client.close().catch(() => undefined);
  await connection.transport.close().catch(() => undefined);
}

export function createGraftSessionPort(): GraftSessionPort {
  return {
    loadGraftInfo,
    failedGraftInfo,
    closeConnection: closeGraftConnection,
  };
}

async function loadGraftChanges(workspaceRoot: string, relativePath: string): Promise<readonly string[]> {
  if (!workspaceHasHead(workspaceRoot)) {
    return ['no git baseline yet'];
  }

  try {
    const diff = decodeGraftStructDiffResult(await callGraftTool(
      workspaceRoot,
      GRAFT_DIFF_TOOL,
      { path: relativePath },
    ));
    const file = diff.files.find((entry) => entry.path === relativePath);
    if (file == null) {
      return ['no structural changes vs HEAD'];
    }

    const lines = [
      file.summary.replace(`${file.path} | `, ''),
      ...file.diff.added.slice(0, 2).map((entry) => `+ ${entry.kind} ${entry.name}`),
      ...file.diff.changed.slice(0, 2).map((entry) => `~ ${entry.kind} ${entry.name}`),
      ...file.diff.removed.slice(0, 2).map((entry) => `- ${entry.kind} ${entry.name}`),
    ];

    return lines.length > 0 ? lines : ['no structural changes vs HEAD'];
  } catch (cause) {
    return [`graft diff failed: ${cause instanceof Error ? cause.message : String(cause)}`];
  }
}

function workspaceHasHead(workspaceRoot: string): boolean {
  try {
    execFileSync('git', ['rev-parse', '--verify', 'HEAD'], {
      cwd: workspaceRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

async function ensureGraftConnection(workspaceRoot: string): Promise<GraftMcpConnection> {
  if (graftConnection?.workspaceRoot === workspaceRoot) {
    return graftConnection;
  }

  if (graftConnectionPromise != null) {
    const pending = await graftConnectionPromise;
    if (pending.workspaceRoot === workspaceRoot) {
      return pending;
    }
  }

  if (graftConnection != null) {
    await closeGraftConnection();
  }

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolveGraftCliPath(), GRAFT_SERVE_COMMAND],
    cwd: workspaceRoot,
    env: processEnvRecord(),
    stderr: 'pipe',
  });
  const client = new Client({
    name: 'jedit',
    version: '0.0.0',
  });

  const connectionPromise = (async () => {
    try {
      await client.connect(transport);
      const connection = {
        workspaceRoot,
        client,
        transport,
      };
      graftConnection = connection;
      return connection;
    } catch (cause) {
      await transport.close().catch(() => undefined);
      throw cause;
    } finally {
      graftConnectionPromise = undefined;
    }
  })();

  graftConnectionPromise = connectionPromise;
  return connectionPromise;
}

function resolveGraftCliPath(): string {
  if (graftCliPath != null) {
    return graftCliPath;
  }

  try {
    graftCliPath = join(dirname(require.resolve(GRAFT_PACKAGE_JSON_SPECIFIER)), GRAFT_BIN_PATH);
    return graftCliPath;
  } catch (cause) {
    throw new GraftPackageNotFoundError(`${GRAFT_PACKAGE_SPECIFIER} is not installed: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
}

async function callGraftTool(
  workspaceRoot: string,
  name: string,
  args: Record<string, string | number | boolean | null>,
): Promise<JsonValue> {
  const connection = await ensureGraftConnection(workspaceRoot);
  const rawResult = await connection.client.callTool({
    name,
    arguments: args,
  });
  const result = {
    ...rawResult,
    structuredContent: normalizeStructuredContent(rawResult.structuredContent),
  };

  const isError = 'isError' in rawResult && rawResult.isError === true;
  if (isError) {
    throw new GraftToolExecutionError(parseGraftErrorResult(result));
  }

  return parseGraftToolResult(result);
}

function normalizeStructuredContent(value: unknown): JsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (isJsonValue(value)) {
    return value;
  }

  throw new GraftToolExecutionError('Invalid structuredContent returned by graft tool.');
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) {
    return true;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (value == null || typeof value !== 'object') {
    return false;
  }

  return Object.values(value).every(isJsonValue);
}

function parseGraftErrorResult(result: GraftCallToolResult): string {
  if (result.structuredContent !== undefined) {
    return String(result.structuredContent);
  }

  return result.content
    ?.find((block) => block.type === 'text')
    ?.text ?? 'Graft tool returned an error';
}

function parseGraftToolResult(result: GraftCallToolResult): JsonValue {
  if (result.structuredContent !== undefined) {
    return result.structuredContent;
  }

  const text = result.content
    ?.find((block) => block.type === 'text')
    ?.text;

  if (text == null) {
    throw new GraftNoTextContentError('No text content in MCP result');
  }

  const parsed: JsonValue = JSON.parse(text);
  return parsed;
}

export function decodeGraftFileOutlineResult(value: JsonValue): GraftFileOutlineResult {
  const result = asJsonObject(value, 'file_outline');
  return {
    ...(result['jumpTable'] !== undefined ? { jumpTable: decodeGraftJumpTable(result['jumpTable'], 'jumpTable') } : {}),
    ...(result['projection'] !== undefined ? { projection: asString(result['projection'], 'projection') } : {}),
    ...(result['reason'] !== undefined ? { reason: asString(result['reason'], 'reason') } : {}),
  };
}

export function decodeGraftStructDiffResult(value: JsonValue): GraftStructDiffResult {
  const result = asJsonObject(value, 'graft_diff');
  return {
    files: asArray(result['files'], 'files').map((file, index) => decodeGraftDiffFile(file, `files[${String(index)}]`)),
  };
}

function decodeGraftJumpTable(value: JsonValue, path: string): readonly GraftJumpEntry[] {
  return asArray(value, path).map((entry, index) => decodeGraftJumpEntry(entry, `${path}[${String(index)}]`));
}

function decodeGraftJumpEntry(value: JsonValue, path: string): GraftJumpEntry {
  const entry = asJsonObject(value, path);
  return {
    symbol: asString(entry['symbol'], `${path}.symbol`),
    kind: asString(entry['kind'], `${path}.kind`),
    start: asNumber(entry['start'], `${path}.start`),
    end: asNumber(entry['end'], `${path}.end`),
  };
}

function decodeGraftDiffFile(value: JsonValue, path: string): GraftStructDiffResult['files'][number] {
  const file = asJsonObject(value, path);
  const diff = asJsonObject(file['diff'], `${path}.diff`);
  return {
    path: asString(file['path'], `${path}.path`),
    summary: asString(file['summary'], `${path}.summary`),
    diff: {
      added: decodeGraftDiffEntries(diff['added'], `${path}.diff.added`),
      changed: decodeGraftDiffEntries(diff['changed'], `${path}.diff.changed`),
      removed: decodeGraftDiffEntries(diff['removed'], `${path}.diff.removed`),
    },
  };
}

function decodeGraftDiffEntries(value: JsonValue | undefined, path: string): readonly GraftDiffEntry[] {
  return asArray(value, path).map((entry, index) => decodeGraftDiffEntry(entry, `${path}[${String(index)}]`));
}

function decodeGraftDiffEntry(value: JsonValue, path: string): GraftDiffEntry {
  const entry = asJsonObject(value, path);
  return {
    kind: asString(entry['kind'], `${path}.kind`),
    name: asString(entry['name'], `${path}.name`),
  };
}

function asJsonObject(value: JsonValue | undefined, path: string): JsonObject {
  if (!isJsonObject(value)) {
    throw new GraftInvalidPayloadError(`${path} must be an object`);
  }
  return value;
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}

function asArray(value: JsonValue | undefined, path: string): readonly JsonValue[] {
  if (!Array.isArray(value)) {
    throw new GraftInvalidPayloadError(`${path} must be an array`);
  }
  return value;
}

function asString(value: JsonValue | undefined, path: string): string {
  if (typeof value !== 'string') {
    throw new GraftInvalidPayloadError(`${path} must be a string`);
  }
  return value;
}

function asNumber(value: JsonValue | undefined, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new GraftInvalidPayloadError(`${path} must be a finite number`);
  }
  return value;
}

function processEnvRecord(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
}
