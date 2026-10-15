import { relative, isAbsolute, sep } from 'node:path';
import { FILEPATH_STYLE, type FilepathStyle } from '../ports/filepath-style.js';
export interface FilepathDisplayOptions { readonly filepathStyle?: FilepathStyle; readonly gitRoot?: string }
export function displayFilepath(path: string, options: FilepathDisplayOptions): string {
  if (options.filepathStyle === FILEPATH_STYLE.Absolute || options.gitRoot == null) return path;
  const local = relative(options.gitRoot, path);
  if (isAbsolute(local) || local === '..' || local.startsWith(`..${sep}`)) return path;
  return local || '.';
}
