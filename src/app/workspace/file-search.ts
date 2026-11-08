import type { FileEntry } from '../../ports/file-system.js';
import { FileEntryKinds } from '../../ports/file-system.js';
import { FocusPanes } from '../../ports/workspace-focus.js';
import { scrollIndexByRows } from '../../ui/mouse-scroll.js';
import { wrapIndex } from '../list-index.js';
import type { WorkspaceModel } from './model.js';

export interface FileSearchState {
  readonly input: string;
  readonly cursorIndex: number;
}

export interface FileSearchEntry {
  readonly entry: FileEntry;
  readonly index: number;
  readonly matchIndexes: readonly number[];
  readonly depth?: number;
  readonly expanded?: boolean;
  readonly matchesQuery?: boolean;
}

export const EMPTY_FILE_SEARCH: FileSearchState = Object.freeze({ input: '', cursorIndex: 0 });
const PATH_SEPARATOR = '/';
const NO_SELECTION = -1;

export function fileSearchState(model: Pick<WorkspaceModel, 'fileSearch'>): FileSearchState {
  return model.fileSearch ?? EMPTY_FILE_SEARCH;
}

/** The model facts that decide whether the Files explorer and its filter prompt own input. */
export type FileExplorerFocusState = Partial<Pick<WorkspaceModel,
  'fileDrawerOpen' | 'focusPane' | 'settingsOpen' | 'quitConfirmOpen' | 'startupFileModalOpen' | 'commandLine' | 'fileSearchEditing'>>;

export function fileExplorerHasFocus(model: FileExplorerFocusState): boolean {
  return model.fileDrawerOpen === true && model.focusPane === FocusPanes.Files &&
    model.settingsOpen !== true && model.quitConfirmOpen !== true && model.startupFileModalOpen !== true &&
    model.commandLine?.active !== true;
}

export function fileSearchHasFocus(model: FileExplorerFocusState): boolean {
  return fileExplorerHasFocus(model) && model.fileSearchEditing === true;
}

type FileSearchModel = Pick<WorkspaceModel, 'entries' | 'workspaceRoot' | 'workspaceSearchRoot' | 'fileSearch' | 'fileTree'>;

export function fileSearchEntries(model: FileSearchModel): readonly FileSearchEntry[] {
  const query = fileSearchState(model).input.toLowerCase();
  const matches = model.entries.flatMap((entry, index) => {
    if (query.length === 0) return [{ entry, index, matchIndexes: [], matchesQuery: true }];
    if (entry.kind === FileEntryKinds.Parent) return [];
    const path = fuzzyPathMatches(entry.name, query) != null ? entry.name : relativeFilePath(model.workspaceSearchRoot ?? model.workspaceRoot, entry);
    const matches = fuzzyPathMatches(path, query);
    if (matches == null) return [];
    const nameStart = Array.from(path).length - Array.from(entry.name).length;
    return [{ entry, index, matchesQuery: true, matchIndexes: matches.filter((offset) => offset >= nameStart).map((offset) => offset - nameStart) }];
  });
  return withTreeAncestors(model, matches);
}

function withTreeAncestors(model: FileSearchModel, matches: readonly FileSearchEntry[]): readonly FileSearchEntry[] {
  const rows = new Map(matches.map((row) => [row.index, row]));
  const included = new Set(matches.map((row) => row.entry.path));
  for (const match of matches) {
    let parent = model.fileTree?.[match.entry.path]?.parentPath;
    while (parent != null && !included.has(parent)) {
      included.add(parent);
      parent = model.fileTree?.[parent]?.parentPath;
    }
  }
  return model.entries.flatMap((entry, index) => included.has(entry.path)
    ? [{ ...(rows.get(index) ?? { entry, index, matchIndexes: [], matchesQuery: false }), ...model.fileTree?.[entry.path] }]
    : []);
}

function relativeFilePath(root: string, entry: FileEntry): string {
  const prefix = root?.endsWith(PATH_SEPARATOR) ? root : `${root ?? ''}${PATH_SEPARATOR}`;
  const path = entry.searchPath ?? entry.path ?? entry.name;
  // Outside the search root (after following `..` upward) only the name is
  // searchable; the absolute path would leak ancestor text into every match.
  return path.startsWith(prefix) ? path.slice(prefix.length) : entry.name;
}

function fuzzyPathMatches(path: string, query: string): readonly number[] | undefined {
  const candidate = Array.from(path).flatMap((character, index) => (
    Array.from(character.toLowerCase()).map((value) => ({ value, index }))
  ));
  const matches: number[] = [];
  let offset = 0;
  for (const character of query) {
    while (offset < candidate.length && candidate[offset]?.value !== character) offset += 1;
    const matched = candidate[offset];
    if (matched == null) return undefined;
    matches.push(matched.index);
    offset += 1;
  }
  return matches;
}

export function selectedFileSearchEntry(model: WorkspaceModel): FileEntry | undefined {
  return fileSearchEntries(model).find(({ index }) => index === model.selectedIndex)?.entry;
}

export function fileSearchWithInput(model: WorkspaceModel, search: FileSearchState): WorkspaceModel {
  const next = { ...model, fileSearch: search, fileHoveredIndex: undefined };
  return { ...next, selectedIndex: fileSearchEntries(next).find((row) => row.matchesQuery !== false)?.index ?? NO_SELECTION };
}

export function moveFileSearchSelection(model: WorkspaceModel, delta: number): WorkspaceModel {
  const entries = fileSearchEntries(model);
  if (entries.length === 0) return model;
  const position = entries.findIndex(({ index }) => index === model.selectedIndex);
  const next = entries[wrapIndex(position + delta, entries.length)];
  return next == null ? model : { ...model, selectedIndex: next.index, fileHoveredIndex: undefined };
}

export function scrollFileSearchSelection(model: WorkspaceModel, delta: number): WorkspaceModel {
  const entries = fileSearchEntries(model);
  if (entries.length === 0) return model;
  const position = entries.findIndex(({ index }) => index === model.selectedIndex);
  const next = entries[scrollIndexByRows(position, entries.length, delta)];
  return next == null ? model : { ...model, selectedIndex: next.index, fileHoveredIndex: undefined };
}
