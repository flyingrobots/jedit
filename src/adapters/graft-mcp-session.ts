import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative } from 'node:path';

const require = createRequire(import.meta.url);

const GRAFT_PACKAGE_SPECIFIER = '@flyingrobots/graft';
const GRAFT_PACKAGE_JSON_SPECIFIER = '@flyingrobots/graft/package.json';
const GRAFT_BIN_PATH = 'bin/graft.js';
const GRAFT_SERVE_COMMAND = 'serve';

export interface GraftOutlineItem {
  readonly kind: string;
  readonly name: string;
  readonly signature?: string;
  readonly startLine: number;
  readonly endLine: number;
}

export interface GraftInfo {
  readonly path: string;
  readonly relativePath: string;
  readonly dirty: boolean;
  readonly outlineItems: readonly GraftOutlineItem[];
  readonly changeLines: readonly string[];
  readonly notice?: string;
  readonly error?: string;
}

interface GraftJumpEntry {
  readonly symbol: string;
  readonly kind: string;
  readonly start: number;
  readonly end: number;
}

interface GraftDiffEntry {
  readonly name: string;
  readonly kind: string;
}

interface GraftStructDiffResult {
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

interface GraftToolResult<T> {
  readonly isError?: boolean;
  readonly structuredContent?: T;
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
    const outline = await callGraftTool<{
      readonly jumpTable?: readonly GraftJumpEntry[];
      readonly projection?: string;
      readonly reason?: string;
    }>(
      workspaceRoot,
      'file_outline',
      { path: relativePath },
    );
    if (outline.projection === 'refused') {
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

async function loadGraftChanges(workspaceRoot: string, relativePath: string): Promise<readonly string[]> {
  if (!workspaceHasHead(workspaceRoot)) {
    return ['no git baseline yet'];
  }

  try {
    const diff = await callGraftTool<GraftStructDiffResult>(
      workspaceRoot,
      'graft_diff',
      { path: relativePath },
    );
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
    throw new Error(`${GRAFT_PACKAGE_SPECIFIER} is not installed: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
}

async function callGraftTool<T>(
  workspaceRoot: string,
  name: string,
  args: Record<string, string | number | boolean | null>,
): Promise<T> {
  const connection = await ensureGraftConnection(workspaceRoot);
  const result = await connection.client.callTool({
    name,
    arguments: args,
  }) as GraftToolResult<T>;

  if (result.isError === true) {
    throw new Error(parseGraftErrorResult(result));
  }

  return parseGraftToolResult(result);
}

function parseGraftErrorResult<T>(result: GraftToolResult<T>): string {
  if (result.structuredContent !== undefined) {
    return String(result.structuredContent);
  }

  return result.content
    ?.find((block) => block.type === 'text')
    ?.text ?? 'Graft tool returned an error';
}

function parseGraftToolResult<T>(result: GraftToolResult<T>): T {
  if (result.structuredContent !== undefined) {
    return result.structuredContent;
  }

  const text = result.content
    ?.find((block) => block.type === 'text')
    ?.text;

  if (text == null) {
    throw new Error('No text content in MCP result');
  }

  return JSON.parse(text) as T;
}

function processEnvRecord(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
}
