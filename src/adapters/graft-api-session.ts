import { createRepoLocalGraft } from '@flyingrobots/graft';
import { execFileSync } from 'node:child_process';
import { isAbsolute, relative } from 'node:path';
import {
  GraftProjectionPostures,
  GraftProjectionSources,
  type FailedGraftInfoRequest,
  type GraftFileRequest,
  type GraftInfo,
  type GraftObstructionReceiptProjection,
  type GraftProjectionPosture,
  type GraftSessionPort,
} from '../ports/graft-session.js';

import { GraftInvalidPayloadError } from '../domain/errors.js';

const GRAFT_FILE_OUTLINE_TOOL = 'file_outline';
const GRAFT_DIFF_TOOL = 'graft_diff';
const GRAFT_PROJECTION_REFUSED = 'refused';
const SAVED_FILE_ONLY_NOTICE = 'saved file only; unsaved buffer edits not included';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | readonly JsonValue[] | JsonObject;
type GraftToolName = typeof GRAFT_FILE_OUTLINE_TOOL | typeof GRAFT_DIFF_TOOL;
type GraftToolArgs = Record<string, JsonValue>;
type DefaultGraftApiSession = ReturnType<typeof createRepoLocalGraft>;

interface JsonObject {
  readonly [key: string]: JsonValue;
}

export interface GraftApiCreateOptions {
  readonly cwd: string;
}

export interface GraftApiBindings<TSession = DefaultGraftApiSession> {
  createRepoLocalGraft(options: GraftApiCreateOptions): TSession;
  callGraftTool(session: TSession, name: GraftToolName, args: GraftToolArgs): Promise<JsonValue>;
}

export interface GraftSessionPortOptions<TSession = DefaultGraftApiSession> {
  readonly api?: GraftApiBindings<TSession>;
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
  readonly obstructionReceipt?: GraftObstructionReceiptProjection;
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

interface GraftOutlineProjection {
  readonly outlineItems: readonly GraftOutlineItem[];
  readonly error?: string;
  readonly obstructionReceipt?: GraftObstructionReceiptProjection;
}

interface SavedFileProjectionPostureInput {
  readonly dirty: boolean;
  readonly error?: string;
}

interface GraftTextBlock {
  readonly type: string;
  readonly text?: string;
}

interface GraftToolResult {
  readonly content: readonly GraftTextBlock[];
}

interface GraftApiConnection<TSession> {
  readonly workspaceRoot: string;
  readonly session: TSession;
}

interface GraftApiSessionManager {
  callTool(workspaceRoot: string, name: GraftToolName, args: GraftToolArgs): Promise<JsonValue>;
  close(): Promise<void>;
}

export function createGraftSessionPort<TSession = DefaultGraftApiSession>(
  options: GraftSessionPortOptions<TSession> = {},
): GraftSessionPort {
  const manager = options.api == null
    ? createGraftApiSessionManager(defaultGraftApiBindings())
    : createGraftApiSessionManager(options.api);

  return {
    loadGraftInfo: (request) => loadGraftInfo(request, manager),
    failedGraftInfo,
    closeConnection: manager.close,
  };
}

function defaultGraftApiBindings(): GraftApiBindings {
  return {
    createRepoLocalGraft,
    async callGraftTool(session, name, args) {
      return parseGraftToolResult(await session.callTool(name, args));
    },
  };
}

function createGraftApiSessionManager<TSession>(api: GraftApiBindings<TSession>): GraftApiSessionManager {
  let connection: GraftApiConnection<TSession> | undefined;

  return {
    async callTool(workspaceRoot, name, args) {
      const activeConnection = connection?.workspaceRoot === workspaceRoot
        ? connection
        : createConnection(api, workspaceRoot);
      connection = activeConnection;
      return api.callGraftTool(activeConnection.session, name, args);
    },
    async close() {
      connection = undefined;
    },
  };
}

function createConnection<TSession>(
  api: GraftApiBindings<TSession>,
  workspaceRoot: string,
): GraftApiConnection<TSession> {
  return {
    workspaceRoot,
    session: api.createRepoLocalGraft({ cwd: workspaceRoot }),
  };
}

async function loadGraftInfo(request: GraftFileRequest, manager: GraftApiSessionManager): Promise<GraftInfo> {
  const { workspaceRoot, filePath, dirty } = request;
  const relativePath = relative(workspaceRoot, filePath).replace(/\\/g, '/');
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    return outsideWorkspaceGraftInfo({ filePath, dirty });
  }

  const outline = await loadGraftOutline(manager, workspaceRoot, relativePath);
  return {
    path: filePath,
    relativePath,
    dirty,
    projectionSource: GraftProjectionSources.SavedFile,
    projectionPosture: savedFileProjectionPosture({
      dirty,
      ...(outline.error == null ? {} : { error: outline.error }),
    }),
    outlineItems: outline.outlineItems,
    changeLines: await loadGraftChanges(manager, workspaceRoot, relativePath),
    ...(outline.obstructionReceipt != null ? { obstructionReceipt: outline.obstructionReceipt } : {}),
    ...(dirty ? { notice: SAVED_FILE_ONLY_NOTICE } : {}),
    ...(outline.error != null ? { error: outline.error } : {}),
  };
}

function savedFileProjectionPosture(input: SavedFileProjectionPostureInput): GraftProjectionPosture {
  if (input.error != null) {
    return GraftProjectionPostures.Obstructed;
  }
  return input.dirty ? GraftProjectionPostures.Stale : GraftProjectionPostures.Current;
}

function outsideWorkspaceGraftInfo(request: Pick<GraftFileRequest, 'filePath' | 'dirty'>): GraftInfo {
  return {
    path: request.filePath,
    relativePath: request.filePath,
    dirty: request.dirty,
    projectionSource: GraftProjectionSources.Unavailable,
    projectionPosture: GraftProjectionPostures.Unavailable,
    outlineItems: [],
    changeLines: ['outside workspace root'],
    error: 'Graft only runs against files inside the launch workspace.',
  };
}

async function loadGraftOutline(
  manager: GraftApiSessionManager,
  workspaceRoot: string,
  relativePath: string,
): Promise<GraftOutlineProjection> {
  try {
    const outline = decodeGraftFileOutlineResult(await manager.callTool(
      workspaceRoot,
      GRAFT_FILE_OUTLINE_TOOL,
      { path: relativePath },
    ));
    if (outline.projection === GRAFT_PROJECTION_REFUSED) {
      return {
        outlineItems: [],
        error: outline.reason ?? 'outline refused',
        ...(outline.obstructionReceipt != null ? { obstructionReceipt: outline.obstructionReceipt } : {}),
      };
    }
    return {
      outlineItems: graftOutlineItems(outline),
      ...(outline.obstructionReceipt != null ? { obstructionReceipt: outline.obstructionReceipt } : {}),
    };
  } catch (cause) {
    return { outlineItems: [], error: `graft outline failed: ${cause instanceof Error ? cause.message : String(cause)}` };
  }
}

function graftOutlineItems(outline: GraftFileOutlineResult): readonly GraftOutlineItem[] {
  return (outline.jumpTable ?? []).map((entry) => ({
    kind: entry.kind,
    name: entry.symbol,
    startLine: entry.start,
    endLine: entry.end,
  }));
}

export function failedGraftInfo(request: FailedGraftInfoRequest): GraftInfo {
  const { workspaceRoot, filePath, dirty, message } = request;
  return {
    path: filePath,
    relativePath: relative(workspaceRoot, filePath).replace(/\\/g, '/'),
    dirty,
    projectionSource: GraftProjectionSources.Unavailable,
    projectionPosture: GraftProjectionPostures.Obstructed,
    outlineItems: [],
    changeLines: [],
    error: `graft request failed: ${message}`,
    ...(dirty ? { notice: SAVED_FILE_ONLY_NOTICE } : {}),
  };
}

async function loadGraftChanges(
  manager: GraftApiSessionManager,
  workspaceRoot: string,
  relativePath: string,
): Promise<readonly string[]> {
  if (!workspaceHasHead(workspaceRoot)) {
    return ['no git baseline yet'];
  }

  try {
    const diff = decodeGraftStructDiffResult(await manager.callTool(
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

export function parseGraftToolResult(result: GraftToolResult): JsonValue {
  const text = result.content
    .find((block) => block.type === 'text')
    ?.text;

  if (text == null) {
    throw new GraftInvalidPayloadError('Graft tool result did not contain a text payload');
  }

  return parseJsonText(text);
}

function parseJsonText(text: string): JsonValue {
  try {
    return parseJsonValue(JSON.parse(text), 'Graft tool result');
  } catch (cause) {
    if (cause instanceof GraftInvalidPayloadError) {
      throw cause;
    }
    throw new GraftInvalidPayloadError(`Graft tool result must be JSON: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
}

function parseJsonValue(value: JsonValue | undefined, path: string): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return parseJsonNumber(value, path);
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) => parseJsonValue(entry, `${path}[${String(index)}]`));
  }
  if (isJsonObject(value)) {
    return parseJsonObjectValue(value, path);
  }
  throw new GraftInvalidPayloadError(`${path} must be JSON`);
}

function parseJsonNumber(value: number, path: string): number {
  if (!Number.isFinite(value)) {
    throw new GraftInvalidPayloadError(`${path} must be a finite number`);
  }
  return value;
}

function parseJsonObjectValue(value: JsonObject, path: string): JsonObject {
  const result: Record<string, JsonValue> = {};
  for (const [key, child] of Object.entries(value)) {
    result[key] = parseJsonValue(child, `${path}.${key}`);
  }
  return result;
}

export function decodeGraftFileOutlineResult(value: JsonValue): GraftFileOutlineResult {
  const result = asJsonObject(value, 'file_outline');
  return {
    ...(result['jumpTable'] !== undefined ? { jumpTable: decodeGraftJumpTable(result['jumpTable'], 'jumpTable') } : {}),
    ...(result['projection'] !== undefined ? { projection: asString(result['projection'], 'projection') } : {}),
    ...(result['reason'] !== undefined ? { reason: asString(result['reason'], 'reason') } : {}),
    ...(result['obstructionReceipt'] !== undefined
      ? { obstructionReceipt: decodeGraftObstructionReceipt(result['obstructionReceipt'], 'obstructionReceipt') }
      : {}),
  };
}

function decodeGraftObstructionReceipt(value: JsonValue, path: string): GraftObstructionReceiptProjection {
  const receipt = asJsonObject(value, path);
  const targetIrDomain = receipt['targetIrDomain'];
  const reasonKind = receipt['reasonKind'];
  const reasonPayload = receipt['reasonPayload'];
  const opaqueReceipt = receipt['receipt'];
  return {
    outcomeKind: asString(receipt['outcomeKind'], `${path}.outcomeKind`),
    targetIrDigest: asString(receipt['targetIrDigest'], `${path}.targetIrDigest`),
    ...(targetIrDomain !== undefined ? { targetIrDomain: asString(targetIrDomain, `${path}.targetIrDomain`) } : {}),
    ...(reasonKind !== undefined ? { reasonKind: asString(reasonKind, `${path}.reasonKind`) } : {}),
    ...(reasonPayload !== undefined ? { reasonPayload: asJsonObject(reasonPayload, `${path}.reasonPayload`) } : {}),
    ...(opaqueReceipt !== undefined ? { receipt: asJsonObject(opaqueReceipt, `${path}.receipt`) } : {}),
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
