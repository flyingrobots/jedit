#!/usr/bin/env node

import { pathToFileURL } from 'node:url';
import path from 'node:path';

const COMMAND_LIST = 'list';
const COMMAND_EXPORT = 'export';
const OPTION_JSON = '--json';
const OPTION_WORKSPACE = '--workspace';
const OPTION_BASIS = '--basis';
const OPTION_OUTPUT = '--output';
const DIST_ROOT = 'dist';
const UTF8_ENCODING = 'utf8';
const SETTLEMENT_SCHEMA_VERSION = 'jedit.workspace_text_edit_settlement.v1';

const options = parseArgs(process.argv.slice(2));
const modules = await loadModules();
const result = runCommand(options, modules);
process.stdout.write(`${JSON.stringify(result.body, null, 2)}\n`);
process.exitCode = result.exitCode;

function parseArgs(args) {
  const parsed = {
    command: args[0],
    json: false,
    workspace: process.cwd(),
    basisId: undefined,
    outputPath: undefined,
  };
  if (parsed.command == null || parsed.command.startsWith('--')) {
    throwUsage('missing command');
  }
  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === OPTION_JSON) {
      parsed.json = true;
    } else if (arg === OPTION_WORKSPACE) {
      parsed.workspace = requiredValue(args, index, arg);
      index += 1;
    } else if (arg === OPTION_BASIS) {
      parsed.basisId = requiredValue(args, index, arg);
      index += 1;
    } else if (arg === OPTION_OUTPUT) {
      parsed.outputPath = requiredValue(args, index, arg);
      index += 1;
    } else {
      throwUsage(`unknown argument: ${arg}`);
    }
  }
  return parsed;
}

function runCommand(options, modules) {
  const store = modules.store.createNodeJeditWscWorkspaceStore(options.workspace);
  if (options.command === COMMAND_LIST) {
    return { exitCode: 0, body: modules.history.listJeditWscHistory(store) };
  }
  if (options.command === COMMAND_EXPORT) {
    return exportHistoryBasis(options, modules, store);
  }
  throwUsage(`unknown command: ${options.command}`);
}

function exportHistoryBasis(options, modules, store) {
  if (options.basisId == null) {
    return obstruction('missing_basis_id', 'export requires --basis');
  }
  if (options.outputPath == null) {
    return obstruction('missing_output_path', 'export requires --output');
  }
  const materializer = createSettlementMaterializer(options.outputPath, modules.ports);
  const result = modules.currentExport.exportJeditWscHistoryAtBasis({
    store,
    basisId: options.basisId,
    editorFile: modules.editorFile.editorFilePort,
    materializer,
  });
  return result.status === modules.ports.JEDIT_WSC_CURRENT_HISTORY_EXPORTED
    ? { exitCode: 0, body: exportedBody(result, materializer) }
    : { exitCode: 1, body: result };
}

function createSettlementMaterializer(outputPath, ports) {
  return {
    artifact: undefined,
    materialize(envelope) {
      const payload = JSON.parse(Buffer.from(envelope.bytes).toString(UTF8_ENCODING));
      if (payload?.schemaVersion !== SETTLEMENT_SCHEMA_VERSION || !Array.isArray(payload.reading?.lines)) {
        return {
          status: ports.JEDIT_WSC_CURRENT_HISTORY_MATERIALIZATION_OBSTRUCTED,
          obstruction: {
            code: ports.JEDIT_WSC_CURRENT_HISTORY_MATERIALIZATION_FAILED,
            message: 'basis is not an applied WSC settlement envelope',
          },
        };
      }
      this.artifact = {
        filePath: path.resolve(outputPath),
        lines: payload.reading.lines,
        readingId: String(payload.reading.readingId ?? ''),
      };
      return {
        status: ports.JEDIT_WSC_CURRENT_HISTORY_MATERIALIZED,
        artifact: this.artifact,
      };
    },
  };
}

function exportedBody(result, materializer) {
  return {
    ...result,
    artifact: {
      path: result.filePath,
      lines: materializer.artifact?.lines ?? [],
    },
  };
}

function obstruction(code, message) {
  return {
    exitCode: 1,
    body: {
      status: 'JEDIT_WSC_CURRENT_HISTORY_EXPORT_OBSTRUCTED',
      obstruction: { code, message },
    },
  };
}

function requiredValue(args, index, arg) {
  const value = args[index + 1];
  if (value == null || value.startsWith('--')) {
    throwUsage(`missing value for ${arg}`);
  }
  return value;
}

function throwUsage(message) {
  process.stderr.write(`${message}\n`);
  process.stderr.write('Usage: node scripts/jedit-wsc-history.mjs list|export --json [--workspace path] [--basis id] [--output path]\n');
  process.exit(1);
}

async function loadModules() {
  const [history, currentExport, ports, store, editorFile] = await Promise.all([
    importDist('app/jedit-wsc-history-listing.js'),
    importDist('app/jedit-wsc-current-history-export.js'),
    importDist('ports/jedit-wsc-current-history-export.js'),
    importDist('adapters/jedit-wsc-workspace-store.js'),
    importDist('adapters/editor-file.js'),
  ]);
  return { history, currentExport, ports, store, editorFile };
}

async function importDist(specifier) {
  return import(pathToFileURL(path.join(process.cwd(), DIST_ROOT, specifier)).href);
}
