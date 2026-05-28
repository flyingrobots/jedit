import { stringToSurface, type Surface } from '@flyingrobots/bijou';
import { fitBlock } from '../../ui/workspace-render.js';
import {
  MIN_COLUMNS,
  MIN_ROWS,
} from './viewport.js';

export function renderSmallTerminalNotice(columns: number, rows: number): Surface {
  const message = [
    '',
    'jedit',
    '',
    `need at least ${MIN_COLUMNS} columns x ${MIN_ROWS} rows`,
    `current terminal: ${columns} x ${rows}`,
  ].join('\n');
  return stringToSurface(fitBlock(message, columns, rows), columns, rows);
}
