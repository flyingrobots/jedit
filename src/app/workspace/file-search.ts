import type { FileEntry } from '../../ports/file-system.js';
import { FileEntryKinds } from '../../ports/file-system.js';
import { FocusPanes } from '../../ui/panel-focus.js';
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
}

export const EMPTY_FILE_SEARCH: FileSearchState = Object.freeze({ input: '', cursorIndex: 0 });
const PATH_SEPARATOR = '/';
const NO_SELECTION = -1;

export function fileSearchState(model: Pick<WorkspaceModel, 'fileSearch'>): FileSearchState {
  return model.fileSearch ?? EMPTY_FILE_SEARCH;
}

export function fileExplorerHasFocus(model: WorkspaceModel): boolean {
  return model.fileDrawerOpen && model.focusPane === FocusPanes.Files &&
    !model.settingsOpen && !model.quitConfirmOpen && !model.startupFileModalOpen && !model.commandLine?.active;
}

export function fileSearchHasFocus(model: WorkspaceModel): boolean {
  return fileExplorerHasFocus(model) && model.fileSearchEditing === true;
}

export function fileSearchEntries(model: Pick<WorkspaceModel, 'entries' | 'workspaceRoot' | 'workspaceSearchRoot' | 'fileSearch'>): readonly FileSearchEntry[] {
  const query = fileSearchState(model).input.toLowerCase();
  return model.entries.flatMap((entry, index) => {
    if (query.length === 0) return [{ entry, index, matchIndexes: [] }];
    if (entry.kind === FileEntryKinds.Parent) return [];
    const path = fuzzyPathMatches(entry.name, query) != null ? entry.name : relativeFilePath(model.workspaceSearchRoot ?? model.workspaceRoot, entry);
    const matches = fuzzyPathMatches(path, query);
    if (matches == null) return [];
    const nameStart = Array.from(path).length - Array.from(entry.name).length;
    return [{ entry, index, matchIndexes: matches.filter((offset) => offset >= nameStart).map((offset) => offset - nameStart) }];
  });
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
  return { ...next, selectedIndex: fileSearchEntries(next)[0]?.index ?? NO_SELECTION };
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
