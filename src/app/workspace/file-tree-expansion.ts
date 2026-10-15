import type { Cmd, KeyMsg } from '@flyingrobots/bijou-tui';
import { DIRECTORY_ACTION_OPEN, FileEntryKinds } from '../../ports/file-system.js';
import { directoryChangeFailure, type DirectoryExpansionContext } from './directory-change-failure.js';
import { fileSearchEntries, selectedFileSearchEntry } from './file-search.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';
import { WorkspaceKeys } from './workspace-key.js';

export interface FileTreeNode {
  readonly depth: number;
  readonly parentPath?: string;
  readonly expanded: boolean;
}
const CHILD_DEPTH = 1;
const FIRST_CHILD_OFFSET = 1;
const NO_SELECTION = -1;
const COLLAPSE_KEYS = new Set<string>([WorkspaceKeys.ArrowLeft, WorkspaceKeys.H]);
const TOGGLE_KEYS = new Set<string>([WorkspaceKeys.Enter, WorkspaceKeys.Return]);
const EXPAND_KEYS = new Set<string>([WorkspaceKeys.ArrowRight, WorkspaceKeys.L]);
type Result = [WorkspaceModel, Cmd<WorkspaceMsg>[]];

export function toggleFileTreeDirectory(model: WorkspaceModel, context: DirectoryExpansionContext): Result {
  const entry = selectedFileSearchEntry(model);
  if (entry?.kind !== FileEntryKinds.Directory) return [model, []];
  if (model.fileTree?.[entry.path]?.expanded) return [collapseDirectory(model), []];
  try { return [expandDirectory(model, context), []]; }
  catch (cause) {
    return directoryChangeFailure(model, entry.path, DIRECTORY_ACTION_OPEN, cause instanceof Error ? cause : String(cause), context);
  }
}

export function updateInlineDirectoryKey(msg: KeyMsg, model: WorkspaceModel, context: DirectoryExpansionContext): Result | undefined {
  const entry = selectedFileSearchEntry(model);
  if (entry == null) return undefined;
  if (COLLAPSE_KEYS.has(msg.key)) return collapseOrParent(model);
  if (entry.kind !== FileEntryKinds.Directory) return undefined;
  if (TOGGLE_KEYS.has(msg.key)) return toggleFileTreeDirectory(model, context);
  if (!EXPAND_KEYS.has(msg.key)) return undefined;
  return expandOrEnterChild(model, context);
}

function expandOrEnterChild(model: WorkspaceModel, context: DirectoryExpansionContext): Result {
  const entry = model.entries[model.selectedIndex];
  if (entry == null) return [model, []];
  if (!model.fileTree?.[entry.path]?.expanded) return toggleFileTreeDirectory(model, context);
  const child = fileSearchEntries(model).find((row) => row.index > model.selectedIndex);
  const parentPath = child == null ? undefined : model.fileTree?.[child.entry.path]?.parentPath;
  return [parentPath === entry.path && child != null ? { ...model, selectedIndex: child.index } : model, []];
}

function collapseOrParent(model: WorkspaceModel): Result | undefined {
  const entry = selectedFileSearchEntry(model);
  if (entry == null) return undefined;
  const node = model.fileTree?.[entry.path];
  if (node?.expanded) return [collapseDirectory(model), []];
  const parent = model.entries.findIndex((candidate) => candidate.path === node?.parentPath);
  return parent < 0 ? undefined : [{ ...model, selectedIndex: parent, fileHoveredIndex: undefined }, []];
}

function expandDirectory(model: WorkspaceModel, context: DirectoryExpansionContext): WorkspaceModel {
  const entry = model.entries[model.selectedIndex];
  if (entry == null) return model;
  const node = model.fileTree?.[entry.path] ?? { depth: 0, expanded: false };
  const paths = new Set(model.entries.map((row) => row.path));
  const children = context.fileSystem.loadEntries(entry.path).filter((row) => row.kind !== FileEntryKinds.Parent && !paths.has(row.path));
  const fileTree = { ...model.fileTree, [entry.path]: { ...node, expanded: true } };
  for (const child of children) fileTree[child.path] = { depth: node.depth + CHILD_DEPTH, parentPath: entry.path, expanded: false };
  const entries = [...model.entries.slice(0, model.selectedIndex + FIRST_CHILD_OFFSET), ...children,
    ...model.entries.slice(model.selectedIndex + FIRST_CHILD_OFFSET)];
  return { ...model, entries, fileTree, fileHoveredIndex: undefined };
}

function collapseDirectory(model: WorkspaceModel): WorkspaceModel {
  const entry = model.entries[model.selectedIndex];
  if (entry == null) return model;
  const node = model.fileTree?.[entry.path];
  if (node == null) return model;
  const end = descendantEnd(model, node.depth);
  const removed = new Set(model.entries.slice(model.selectedIndex + FIRST_CHILD_OFFSET, end).map((row) => row.path));
  const fileTree = Object.fromEntries(Object.entries(model.fileTree ?? {}).filter(([path]) => !removed.has(path)));
  fileTree[entry.path] = { ...node, expanded: false };
  const next = { ...model, fileTree, entries: [...model.entries.slice(0, model.selectedIndex + FIRST_CHILD_OFFSET), ...model.entries.slice(end)],
    fileHoveredIndex: undefined };
  const visible = fileSearchEntries(next);
  return { ...next, selectedIndex: visible.some((row) => row.index === model.selectedIndex) ? model.selectedIndex : visible[0]?.index ?? NO_SELECTION };
}

function descendantEnd(model: WorkspaceModel, depth: number): number {
  let end = model.selectedIndex + FIRST_CHILD_OFFSET;
  while (end < model.entries.length && rowDepth(model, end) > depth) end += FIRST_CHILD_OFFSET;
  return end;
}

function rowDepth(model: WorkspaceModel, index: number): number {
  const path = model.entries[index]?.path;
  return path == null ? 0 : model.fileTree?.[path]?.depth ?? 0;
}
