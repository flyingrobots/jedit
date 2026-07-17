#!/usr/bin/env node
const REPORT_FORMAT_JSON = '--json';
const OPTION_COMMAND = '--command';
const WITNESS_FILE_PATH = '/repo/notes.md';
const WITNESS_BUFFER_ID = 'buffer:command-provenance';

const COMMAND_SPECS = Object.freeze([
  {
    command: 'dw',
    keys: ['d', 'w'],
    lines: ['alpha beta'],
  },
  {
    command: 'ciw',
    keys: ['c', 'i', 'w'],
    lines: ['alpha beta'],
  },
  {
    command: 'dd',
    keys: ['d', 'd'],
    lines: ['alpha', 'beta'],
  },
  {
    command: 'gUap',
    keys: ['g', 'U', 'a', 'p'],
    lines: ['alpha', 'beta', '', 'gamma'],
  },
]);

const options = parseArgs(process.argv.slice(2));
const report = await commandProvenanceWitnessReport(options);

if (options.json) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  process.stdout.write(`${report.capability}: ${report.outcome}\n`);
}

function parseArgs(args) {
  const parsed = {
    command: undefined,
    json: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === REPORT_FORMAT_JSON) {
      parsed.json = true;
    } else if (arg === OPTION_COMMAND) {
      parsed.command = requiredOptionValue(args, index);
      index += 1;
    } else {
      failUnknownArgument(arg);
    }
  }
  return parsed;
}

function requiredOptionValue(args, index) {
  const value = args[index + 1];
  if (value == null || value.startsWith('--')) {
    process.stderr.write(`missing value for ${args[index]}\n`);
    process.exit(1);
  }
  return value;
}

function failUnknownArgument(arg) {
  process.stderr.write(`unknown argument: ${arg}\n`);
  process.exit(1);
}

async function commandProvenanceWitnessReport(options) {
  const modules = await loadRuntimeModules();
  const commands = selectedCommandSpecs(options.command).map((spec) => commandWitness(spec, modules));
  return {
    capability: 'jedit.command-provenance-witness',
    outcome: commands.every((command) => command.outcome === 'applied') ? 'applied' : 'obstructed',
    commands,
  };
}

async function loadRuntimeModules() {
  const [mode, syntax, executor, authority, provenance] = await Promise.all([
    import('../dist/app/workspace/editor/mode.js'),
    import('../dist/app/workspace/vim-chord-syntax.js'),
    import('../dist/app/workspace/vim-command-executor.js'),
    import('../dist/app/workspace/workspace-text-authority.js'),
    import('../dist/app/workspace/command-provenance.js'),
  ]);
  return { authority, executor, mode, provenance, syntax };
}

function selectedCommandSpecs(command) {
  if (command == null) {
    return COMMAND_SPECS;
  }
  const selected = COMMAND_SPECS.find((spec) => spec.command === command);
  if (selected == null) {
    process.stderr.write(`unknown command: ${command}\n`);
    process.exit(1);
  }
  return [selected];
}

function commandWitness(spec, modules) {
  const edited = modules.executor.applyVimChordSyntaxToEditor(
    witnessEditor(modules.mode, spec.lines),
    modules.syntax.parseVimChordSyntax(spec.keys),
  );
  if (edited.lastVimEdit == null) {
    return obstructedCommand(spec.command, 'jedit_command_event_missing_repeat');
  }
  return eventWitness(spec.command, edited, modules);
}

function eventWitness(command, edited, modules) {
  const result = modules.provenance.createJeditCommandEvent({
    editor: edited,
    repeat: edited.lastVimEdit,
    textAuthority: witnessTextAuthority(command, modules.authority),
  });
  return result.kind === 'vim'
    ? { command, outcome: 'applied', event: result }
    : { command, outcome: 'obstructed', obstruction: result };
}

function witnessEditor(mode, lines) {
  return {
    path: WITNESS_FILE_PATH,
    lines,
    cursorRow: 0,
    cursorCol: 0,
    scrollRow: 0,
    scrollCol: 0,
    dirty: false,
    readOnly: false,
    mode: mode.EditorModes.Normal,
  };
}

function witnessTextAuthority(command, authority) {
  return authority.openedWorkspaceTextAuthority({
    profile: 'echoHosted',
    filePath: WITNESS_FILE_PATH,
    bufferId: WITNESS_BUFFER_ID,
    readOnly: false,
    dirty: true,
    lastReceiptId: `receipt:${command}`,
  });
}

function obstructedCommand(command, code) {
  return {
    command,
    outcome: 'obstructed',
    obstruction: {
      code,
      message: `Command provenance witness could not record ${command}`,
    },
  };
}
