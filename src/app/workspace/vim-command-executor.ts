import type { EditorState, RegisterKind, RegisterState, VimRepeatTargetState } from './editor/model.js';
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
import {
  parseVimChordSyntax,
  VimChordSyntaxFamilies,
  VimChordSyntaxKinds,
  type VimChordSyntax,
  type VimTextObjectSyntax,
} from './vim-chord-syntax.js';
import { VimOperatorNames, type VimMotionName } from './vim-grammar-vocabulary.js';
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
  VimResolvedTargetShapes,
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

interface VimRepeatFacts {
  readonly sourceBasisDigest?: string;
  readonly target?: VimRepeatTargetState;
}

const NORMAL_MODE = EditorModes.Normal;
const INSERT_MODE = EditorModes.Insert;
const RECORD_REPEAT_DEFAULT = true;
const REGISTER_UNNAMED = '"';
const REGISTER_TEXT_EMPTY = '';
const LINE_BREAK_TEXT = '\n';
const LINE_BREAK_LENGTH = 1;
export function applyVimChordSyntaxToEditor(
  editor: EditorState,
  syntax: VimChordSyntax,
  options: VimExecutionOptions = {},
): EditorState {
  const cleanEditor = clearVimPending(editor);
  if (syntax.kind !== VimChordSyntaxKinds.Complete) {
    return cleanEditor;
  }
  if (syntax.family === VimChordSyntaxFamilies.Motion && syntax.motion != null) {
    return applyResolvedMotion(cleanEditor, syntax.motion, syntax.count);
  }
  if (syntax.family === VimChordSyntaxFamilies.ModeSwitch && syntax.modeSwitch != null) {
    return applyVimModeSwitch(cleanEditor, syntax.modeSwitch);
  }
  if (syntax.family === VimChordSyntaxFamilies.Mark && syntax.mark != null) {
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
  if (syntax.family === VimChordSyntaxFamilies.OperatorMotion) {
    return applyOperatorMotion(editor, syntax, options);
  }
  if (syntax.family === VimChordSyntaxFamilies.OperatorTextObject) {
    return applyOperatorTextObject(editor, syntax, options);
  }
  if (syntax.family === VimChordSyntaxFamilies.Put && syntax.operator != null) {
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
  if (syntax.operator === VimOperatorNames.DeleteToLineEnd) {
    const target = lineEndTarget(editor);
    return withRepeat(
      applyDeleteRange(editor, syntax, target),
      syntax,
      options,
      repeatFactsForTarget(target),
    );
  }
  if (syntax.operator === VimOperatorNames.ChangeToLineEnd) {
    const target = lineEndTarget(editor);
    return withRepeat(
      applyChangeRange(editor, syntax, target),
      syntax,
      options,
      repeatFactsForTarget(target),
    );
  }
  if (syntax.operator === VimOperatorNames.YankLine) {
    return applyYankRange(editor, syntax, currentLineTarget(editor));
  }
  if (syntax.operator === VimOperatorNames.JoinWithSpace || syntax.operator === VimOperatorNames.JoinNoSpace) {
    return withRepeat(
      applyVimJoinCurrentLine(editor, syntax.operator === VimOperatorNames.JoinWithSpace ? 'spaced' : 'compact'),
      syntax,
      options,
      repeatFactsForBasis(editor),
    );
  }
  if (syntax.operator === VimOperatorNames.DeleteChar) {
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
  const target = {
    basisDigest: basisDigest(editor),
    range: { start, end: start + count },
    shape: VimResolvedTargetShapes.Charwise,
  };
  const next = applyDeleteRange(editor, syntax, target);
  return withRepeat(next, syntax, options, repeatFactsForTarget(target));
}

function applyOperatorTarget(
  editor: EditorState,
  syntax: VimChordSyntax,
  target: VimOperatorTarget,
  options: VimExecutionOptions,
): EditorState {
  if (syntax.operator === VimOperatorNames.Delete) {
    return withRepeat(applyDeleteRange(editor, syntax, target), syntax, options, repeatFactsForTarget(target));
  }
  if (syntax.operator === VimOperatorNames.Change) {
    return withRepeat(applyChangeRange(editor, syntax, target), syntax, options, repeatFactsForTarget(target));
  }
  if (syntax.operator === VimOperatorNames.Yank) {
    return applyYankRange(editor, syntax, target);
  }
  if (isVimCaseTransformOperator(syntax.operator)) {
    return withRepeat(
      applyVimCaseTransform(editor, mutationRangeForTarget(editor, target), vimCaseTransformForOperator(syntax.operator)),
      syntax,
      options,
      repeatFactsForTarget(target),
    );
  }
  return editor;
}

function applyDeleteRange(
  editor: EditorState,
  syntax: VimChordSyntax,
  target: VimOperatorTarget,
): EditorState {
  const register = registerFromRange(editor, target, VimOperatorNames.Delete);
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
  const register = registerFromRange(editor, target, VimOperatorNames.Change);
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
  const register = registerFromRange(editor, target, VimOperatorNames.Yank);
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
  const placement = syntax.operator === VimOperatorNames.PutBefore
    ? PastePlacements.Before
    : PastePlacements.After;
  const next = pasteRegister({ ...editor, register }, placement);
  return withRepeat(next, syntax, options, repeatFactsForBasis(editor));
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
    shape: VimResolvedTargetShapes.Linewise,
  };
}

function lineEndTarget(editor: EditorState): VimOperatorTarget {
  return {
    basisDigest: basisDigest(editor),
    range: {
      start: cursorIndex(editor),
      end: currentLineEndIndex(editor),
    },
    shape: VimResolvedTargetShapes.Charwise,
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
  return shape === VimResolvedTargetShapes.Linewise && text.endsWith(LINE_BREAK_TEXT)
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
  facts: VimRepeatFacts,
): EditorState {
  return options.recordRepeat ?? RECORD_REPEAT_DEFAULT
    ? {
      ...editor,
      lastVimEdit: {
        keys: syntax.keys,
        description: repeatDescription(syntax),
        replayPolicy: 'resolve-current-basis',
        ...(facts.sourceBasisDigest == null ? {} : { sourceBasisDigest: facts.sourceBasisDigest }),
        ...(facts.target == null ? {} : { target: facts.target }),
      },
    }
    : editor;
}

function repeatFactsForBasis(editor: EditorState): VimRepeatFacts {
  return { sourceBasisDigest: basisDigest(editor) };
}

function repeatFactsForTarget(target: VimOperatorTarget): VimRepeatFacts {
  return {
    sourceBasisDigest: target.basisDigest,
    target: {
      basisDigest: target.basisDigest,
      rangeEnd: target.range.end,
      rangeStart: target.range.start,
      shape: target.shape,
    },
  };
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
  return shape === VimResolvedTargetShapes.Linewise ? RegisterKinds.Line : RegisterKinds.Char;
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
  if (target.shape !== VimResolvedTargetShapes.Linewise) {
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
  if (target.shape === VimResolvedTargetShapes.Linewise && target.range.end >= editorText(editor).length) {
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
