import type { EditorState, RegisterKind, RegisterState } from './editor/model.js';
import { RegisterKinds } from './editor/model.js';
import { EditorModes } from './editor/mode.js';
import { PastePlacements } from './editor/key.js';
import {
  deleteTextRange,
  editorText,
  lineStartTextIndex,
  pasteRegister,
  yankTextRange,
} from './editor-editing-core.js';
import { parseVimChordSyntax, type VimChordSyntax, type VimTextObjectSyntax } from './vim-chord-syntax.js';
import type { VimMotionName } from './vim-grammar-vocabulary.js';
import {
  applyVimCaseTransform,
  applyVimJoinCurrentLine,
  applyVimMarkCommand,
  applyVimModeSwitch,
  isVimCaseTransformOperator,
  vimCaseTransformForOperator,
} from './vim-editor-operators.js';
import {
  resolveVimMotion,
  type VimResolvedMotion,
  type VimResolvedTargetShape,
  type VimTextRange,
  vimMotionBasisDigest,
} from './vim-motion-resolver.js';
import {
  resolveVimTextObject,
  type VimResolvedTextObject,
} from './vim-text-object-resolver.js';

export interface VimExecutionOptions {
  readonly recordRepeat?: boolean;
}

interface VimOperatorTarget {
  readonly basisDigest: string;
  readonly range: VimTextRange;
  readonly shape: VimResolvedTargetShape;
}

const FAMILY_MODE_SWITCH = 'modeSwitch';
const FAMILY_MARK = 'mark';
const FAMILY_MOTION = 'motion';
const FAMILY_OPERATOR_MOTION = 'operatorMotion';
const FAMILY_OPERATOR_TEXT_OBJECT = 'operatorTextObject';
const FAMILY_PUT = 'put';
const SYNTAX_KIND_COMPLETE = 'complete';
const NORMAL_MODE = EditorModes.Normal;
const INSERT_MODE = EditorModes.Insert;
const RECORD_REPEAT_DEFAULT = true;
const REGISTER_UNNAMED = '"';
const REGISTER_TEXT_EMPTY = '';
const LINE_BREAK_TEXT = '\n';
const LINE_BREAK_LENGTH = 1;
const OPERATOR_CHANGE = 'change';
const OPERATOR_CHANGE_TO_LINE_END = 'changeToLineEnd';
const OPERATOR_DELETE = 'delete';
const OPERATOR_DELETE_CHAR = 'deleteChar';
const OPERATOR_DELETE_TO_LINE_END = 'deleteToLineEnd';
const OPERATOR_JOIN_NO_SPACE = 'joinNoSpace';
const OPERATOR_JOIN_WITH_SPACE = 'joinWithSpace';
const OPERATOR_PUT_BEFORE = 'putBefore';
const OPERATOR_YANK = 'yank';
const OPERATOR_YANK_LINE = 'yankLine';
const OPERATION_CHANGE = 'change';
const OPERATION_DELETE = 'delete';
const OPERATION_YANK = 'yank';
const TARGET_SHAPE_LINEWISE = 'linewise';
const TARGET_SHAPE_CHARWISE = 'charwise';

export function applyVimChordSyntaxToEditor(
  editor: EditorState,
  syntax: VimChordSyntax,
  options: VimExecutionOptions = {},
): EditorState {
  const cleanEditor = clearVimPending(editor);
  if (syntax.kind !== SYNTAX_KIND_COMPLETE) {
    return cleanEditor;
  }
  if (syntax.family === FAMILY_MOTION && syntax.motion != null) {
    return applyResolvedMotion(cleanEditor, syntax.motion, syntax.count);
  }
  if (syntax.family === FAMILY_MODE_SWITCH && syntax.modeSwitch != null) {
    return applyVimModeSwitch(cleanEditor, syntax.modeSwitch);
  }
  if (syntax.family === FAMILY_MARK && syntax.mark != null) {
    return applyVimMarkCommand(cleanEditor, syntax.mark, basisDigest(cleanEditor));
  }
  return applyCompleteCommand(cleanEditor, syntax, options);
}

export function repeatLastVimEdit(editor: EditorState): EditorState {
  const repeat = editor.lastVimEdit;
  if (repeat == null) {
    return clearVimPending(editor);
  }
  return applyVimChordSyntaxToEditor(editor, parseVimChordSyntax(repeat.keys), {
    recordRepeat: false,
  });
}

function applyCompleteCommand(
  editor: EditorState,
  syntax: VimChordSyntax,
  options: VimExecutionOptions,
): EditorState {
  if (syntax.family === FAMILY_OPERATOR_MOTION) {
    return applyOperatorMotion(editor, syntax, options);
  }
  if (syntax.family === FAMILY_OPERATOR_TEXT_OBJECT) {
    return applyOperatorTextObject(editor, syntax, options);
  }
  if (syntax.family === FAMILY_PUT && syntax.operator != null) {
    return applyPutOperator(editor, syntax, options);
  }
  return syntax.operator == null ? editor : applyStandaloneOperator(editor, syntax, options);
}

function applyResolvedMotion(
  editor: EditorState,
  motion: VimMotionName,
  count: number | undefined,
): EditorState {
  const resolved = resolveVimMotion({ editor, motion, count });
  if ('obstruction' in resolved) {
    return editor;
  }
  return {
    ...editor,
    cursorRow: resolved.cursorAfter.row,
    cursorCol: resolved.cursorAfter.column,
  };
}

function applyOperatorMotion(
  editor: EditorState,
  syntax: VimChordSyntax,
  options: VimExecutionOptions,
): EditorState {
  if (syntax.motion == null || syntax.operator == null) {
    return editor;
  }
  const resolved = resolveVimMotion({
    editor,
    motion: syntax.motion,
    count: syntax.count,
  });
  return 'obstruction' in resolved
    ? editor
    : applyOperatorTarget(editor, syntax, targetFromMotion(resolved), options);
}

function applyOperatorTextObject(
  editor: EditorState,
  syntax: VimChordSyntax,
  options: VimExecutionOptions,
): EditorState {
  if (syntax.operator == null || syntax.textObject == null) {
    return editor;
  }
  const resolved = resolveTextObjectTarget(editor, syntax.textObject, syntax.count);
  return resolved == null
    ? editor
    : applyOperatorTarget(editor, syntax, targetFromTextObject(resolved), options);
}

function resolveTextObjectTarget(
  editor: EditorState,
  textObject: VimTextObjectSyntax,
  count: number | undefined,
): VimResolvedTextObject | undefined {
  const resolved = resolveVimTextObject({
    editor,
    count,
    scope: textObject.scope,
    target: textObject.target,
  });
  return 'obstruction' in resolved ? undefined : resolved;
}

function applyStandaloneOperator(
  editor: EditorState,
  syntax: VimChordSyntax,
  options: VimExecutionOptions,
): EditorState {
  if (syntax.operator === OPERATOR_DELETE_TO_LINE_END) {
    return withRepeat(
      applyDeleteRange(editor, syntax, lineEndTarget(editor)),
      syntax,
      options,
      basisDigest(editor),
    );
  }
  if (syntax.operator === OPERATOR_CHANGE_TO_LINE_END) {
    return withRepeat(
      applyChangeRange(editor, syntax, lineEndTarget(editor)),
      syntax,
      options,
      basisDigest(editor),
    );
  }
  if (syntax.operator === OPERATOR_YANK_LINE) {
    return applyYankRange(editor, syntax, currentLineTarget(editor));
  }
  if (syntax.operator === OPERATOR_JOIN_WITH_SPACE || syntax.operator === OPERATOR_JOIN_NO_SPACE) {
    return withRepeat(
      applyVimJoinCurrentLine(editor, syntax.operator === OPERATOR_JOIN_WITH_SPACE ? 'spaced' : 'compact'),
      syntax,
      options,
      basisDigest(editor),
    );
  }
  if (syntax.operator === OPERATOR_DELETE_CHAR) {
    return applyDeleteChar(editor, syntax, options);
  }
  return editor;
}

function applyDeleteChar(
  editor: EditorState,
  syntax: VimChordSyntax,
  options: VimExecutionOptions,
): EditorState {
  const start = cursorIndex(editor);
  const count = Math.max(1, syntax.count ?? 1);
  const next = applyDeleteRange(editor, syntax, {
    basisDigest: basisDigest(editor),
    range: { start, end: start + count },
    shape: TARGET_SHAPE_CHARWISE,
  });
  return withRepeat(next, syntax, options, basisDigest(editor));
}

function applyOperatorTarget(
  editor: EditorState,
  syntax: VimChordSyntax,
  target: VimOperatorTarget,
  options: VimExecutionOptions,
): EditorState {
  if (syntax.operator === OPERATOR_DELETE) {
    return withRepeat(applyDeleteRange(editor, syntax, target), syntax, options, target.basisDigest);
  }
  if (syntax.operator === OPERATOR_CHANGE) {
    return withRepeat(applyChangeRange(editor, syntax, target), syntax, options, target.basisDigest);
  }
  if (syntax.operator === OPERATOR_YANK) {
    return applyYankRange(editor, syntax, target);
  }
  if (isVimCaseTransformOperator(syntax.operator)) {
    return withRepeat(
      applyVimCaseTransform(editor, mutationRangeForTarget(editor, target), vimCaseTransformForOperator(syntax.operator)),
      syntax,
      options,
      target.basisDigest,
    );
  }
  return editor;
}

function applyDeleteRange(
  editor: EditorState,
  syntax: VimChordSyntax,
  target: VimOperatorTarget,
): EditorState {
  const register = registerFromRange(editor, target, OPERATION_DELETE);
  const mutationRange = mutationRangeForTarget(editor, target);
  const next = deleteTextRange(editor, mutationRange.start, mutationRange.end, {
    mode: NORMAL_MODE,
    register: register.kind,
  });
  return withRegisters(next, syntax.register, register);
}

function applyChangeRange(
  editor: EditorState,
  syntax: VimChordSyntax,
  target: VimOperatorTarget,
): EditorState {
  const register = registerFromRange(editor, target, OPERATION_CHANGE);
  const mutationRange = changeMutationRangeForTarget(editor, target);
  const next = deleteTextRange(editor, mutationRange.start, mutationRange.end, {
    mode: INSERT_MODE,
    register: register.kind,
  });
  return withRegisters(next, syntax.register, register);
}

function applyYankRange(
  editor: EditorState,
  syntax: VimChordSyntax,
  target: VimOperatorTarget,
): EditorState {
  const register = registerFromRange(editor, target, OPERATION_YANK);
  const next = yankTextRange(editor, target.range.start, target.range.end, register.kind);
  return withRegisters(next, syntax.register, register);
}

function applyPutOperator(
  editor: EditorState,
  syntax: VimChordSyntax,
  options: VimExecutionOptions,
): EditorState {
  const register = selectedRegister(editor, syntax.register);
  if (register == null) {
    return editor;
  }
  const placement = syntax.operator === OPERATOR_PUT_BEFORE
    ? PastePlacements.Before
    : PastePlacements.After;
  const next = pasteRegister({ ...editor, register }, placement);
  return withRepeat(next, syntax, options, basisDigest(editor));
}

function targetFromMotion(resolved: VimResolvedMotion): VimOperatorTarget {
  return {
    basisDigest: resolved.basisDigest,
    range: resolved.target,
    shape: resolved.targetShape,
  };
}

function targetFromTextObject(resolved: VimResolvedTextObject): VimOperatorTarget {
  return {
    basisDigest: resolved.basisDigest,
    range: resolved.targetRange,
    shape: resolved.targetShape,
  };
}

function currentLineTarget(editor: EditorState): VimOperatorTarget {
  return {
    basisDigest: basisDigest(editor),
    range: currentLineRange(editor),
    shape: TARGET_SHAPE_LINEWISE,
  };
}

function lineEndTarget(editor: EditorState): VimOperatorTarget {
  return {
    basisDigest: basisDigest(editor),
    range: {
      start: cursorIndex(editor),
      end: currentLineEndIndex(editor),
    },
    shape: TARGET_SHAPE_CHARWISE,
  };
}

function registerFromRange(
  editor: EditorState,
  target: VimOperatorTarget,
  operation: string,
): RegisterState {
  const kind = registerKind(target.shape);
  return {
    kind,
    text: registerText(editor, target.range, target.shape),
    source: {
      basisDigest: target.basisDigest,
      operation,
      rangeStart: target.range.start,
      rangeEnd: target.range.end,
    },
  };
}

function registerText(
  editor: EditorState,
  range: VimTextRange,
  shape: VimResolvedTargetShape,
): string {
  const text = rangeText(editor, range);
  return shape === TARGET_SHAPE_LINEWISE && text.endsWith(LINE_BREAK_TEXT)
    ? text.slice(0, -LINE_BREAK_LENGTH)
    : text;
}

function withRegisters(
  editor: EditorState,
  name: string | undefined,
  register: RegisterState,
): EditorState {
  const registers = {
    ...(editor.registers ?? {}),
    [REGISTER_UNNAMED]: register,
    ...(name == null ? {} : { [name]: register }),
  };
  return {
    ...editor,
    register,
    registers,
  };
}

function selectedRegister(
  editor: EditorState,
  name: string | undefined,
): RegisterState | undefined {
  return name == null ? editor.register : editor.registers?.[name];
}

function withRepeat(
  editor: EditorState,
  syntax: VimChordSyntax,
  options: VimExecutionOptions,
  sourceBasisDigest?: string,
): EditorState {
  return options.recordRepeat ?? RECORD_REPEAT_DEFAULT
    ? {
      ...editor,
      lastVimEdit: {
        keys: syntax.keys,
        description: repeatDescription(syntax),
        replayPolicy: 'resolve-current-basis',
        ...(sourceBasisDigest == null ? {} : { sourceBasisDigest }),
      },
    }
    : editor;
}

function repeatDescription(syntax: VimChordSyntax): string {
  return `${syntax.family}:${syntax.operator ?? REGISTER_TEXT_EMPTY}:${syntax.motion ?? REGISTER_TEXT_EMPTY}`;
}

function clearVimPending(editor: EditorState): EditorState {
  return {
    ...editor,
    pendingVimKeys: undefined,
    pendingNormal: undefined,
  };
}

function registerKind(shape: VimResolvedTargetShape): RegisterKind {
  return shape === TARGET_SHAPE_LINEWISE ? RegisterKinds.Line : RegisterKinds.Char;
}

function rangeText(editor: EditorState, range: VimTextRange): string {
  const text = editorText(editor);
  const start = Math.max(0, Math.min(range.start, range.end));
  const end = Math.max(start, Math.min(text.length, Math.max(range.start, range.end)));
  return text.slice(start, end);
}

function mutationRangeForTarget(
  editor: EditorState,
  target: VimOperatorTarget,
): VimTextRange {
  if (target.shape !== TARGET_SHAPE_LINEWISE) {
    return target.range;
  }
  const text = editorText(editor);
  return target.range.end >= text.length && target.range.start > 0
    ? { start: target.range.start - LINE_BREAK_LENGTH, end: target.range.end }
    : target.range;
}

function changeMutationRangeForTarget(
  editor: EditorState,
  target: VimOperatorTarget,
): VimTextRange {
  if (target.shape === TARGET_SHAPE_LINEWISE && target.range.end >= editorText(editor).length) {
    return target.range;
  }
  return mutationRangeForTarget(editor, target);
}

function cursorIndex(editor: EditorState): number {
  return lineStartTextIndex(editor.lines, editor.cursorRow) + editor.cursorCol;
}

function currentLineRange(editor: EditorState): VimTextRange {
  const start = lineStartTextIndex(editor.lines, editor.cursorRow);
  const end = start + (editor.lines[editor.cursorRow] ?? REGISTER_TEXT_EMPTY).length;
  return { start, end };
}

function currentLineEndIndex(editor: EditorState): number {
  return lineStartTextIndex(editor.lines, editor.cursorRow) + (editor.lines[editor.cursorRow] ?? REGISTER_TEXT_EMPTY).length;
}

function basisDigest(editor: EditorState): string {
  return vimMotionBasisDigest(editor.lines);
}
