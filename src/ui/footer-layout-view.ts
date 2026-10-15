import { createSurface, stringToSurface, type Surface } from '@flyingrobots/bijou';
import { clipToWidth } from '@flyingrobots/bijou-tui';
import type { JeditStyleToken } from './jedit-theme.js';
import { JEDIT_TEXT_MODIFIER } from './jedit-theme.js';
import { FOOTER_LAYOUT, footerLayoutRows, type FooterLayout } from './footer-layout.js';
import { visibleLineLength, fitLine } from './fit-line.js';
import { renderWorkspaceCommandLineFooter, type WorkspaceCommandLineFooterRenderState } from './workspace-command-line-footer.js';

export interface FooterSurfaceObservation {
  readonly label: string;
  readonly identity: string;
  readonly detail: string;
  readonly active: boolean;
  readonly x: number;
  readonly width: number;
}
export interface FooterPresentation {
  readonly layout: FooterLayout;
  readonly surfaces: readonly FooterSurfaceObservation[];
  readonly focused: FooterSurfaceObservation;
  readonly workspace: string;
  readonly globalSummary: string;
  readonly globalCompact: string;
  readonly activeToken: JeditStyleToken;
}
export interface FooterLayoutViewOptions {
  readonly presentation: FooterPresentation;
  readonly width: number;
  readonly background: JeditStyleToken;
  readonly command?: WorkspaceCommandLineFooterRenderState;
}
const ONE_ROW = 1;
const LOCAL_ROW = 0;
const GLOBAL_ROW = 1;
const GAP = '  ';

export function renderFooterLayout(options: FooterLayoutViewOptions): Surface {
  const { presentation, width, background } = options;
  const surface = createSurface(width, footerLayoutRows(presentation.layout));
  surface.fill({ char: ' ', fg: background.fg, fgRGB: background.fgRGB, bg: background.bg, bgRGB: background.bgRGB });
  if (width <= 0) return surface;
  const compact = presentation.layout === FOOTER_LAYOUT.Compact;
  if (options.command != null) paintCommand(surface, options);
  else if (presentation.layout === FOOTER_LAYOUT.PerPane) paintPaneStatuses(surface, options);
  else paintLocal(surface, options);
  if (!compact) {
    paintLine(surface, joinFooterSides(presentation.workspace, presentation.globalSummary, width), { row: GLOBAL_ROW, x: 0, width }, background);
  }
  return surface;
}

function paintLocal(surface: Surface, options: FooterLayoutViewOptions): void {
  const { presentation, width, background } = options;
  const compact = presentation.layout === FOOTER_LAYOUT.Compact;
  const globalWidth = compact ? Math.min(visibleLineLength(presentation.globalCompact) + GAP.length, Math.floor(width / 2)) : 0;
  const localWidth = width - globalWidth;
  paintLocalObservation(surface, { ...presentation.focused, x: 0 }, localWidth, options);
  if (compact) paintLine(surface, fitLine(`${GAP}${presentation.globalCompact}`, globalWidth), { row: LOCAL_ROW, x: localWidth, width: globalWidth }, background);
}

function paintPaneStatuses(surface: Surface, options: FooterLayoutViewOptions): void {
  for (const observation of options.presentation.surfaces) {
    paintLocalObservation(surface, observation, observation.width, options);
  }
}

function paintLocalObservation(surface: Surface, observation: FooterSurfaceObservation, width: number, options: FooterLayoutViewOptions): void {
  const label = `${observation.label} ${observation.identity}`.trimEnd();
  const text = joinFooterSides(label, observation.detail, width);
  const token = observation.active ? {
    ...options.background, ...options.presentation.activeToken, bg: options.background.bg, bgRGB: options.background.bgRGB,
  } : options.background;
  paintLine(surface, text, { row: LOCAL_ROW, x: observation.x, width }, token);
  if (!observation.active) return;
  const end = Math.min(width, visibleLineLength(observation.label));
  for (let x = observation.x; x < observation.x + end; x += 1) {
    const cell = surface.get(x, LOCAL_ROW);
    surface.set(x, LOCAL_ROW, { ...cell, modifiers: [...(cell.modifiers ?? []), JEDIT_TEXT_MODIFIER.Bold] });
  }
}

function paintCommand(surface: Surface, options: FooterLayoutViewOptions): void {
  if (options.command == null) return;
  const compact = options.presentation.layout === FOOTER_LAYOUT.Compact;
  const globalWidth = compact ? Math.min(visibleLineLength(options.presentation.globalCompact) + GAP.length, Math.floor(options.width / 2)) : 0;
  const command = renderWorkspaceCommandLineFooter(options.command, options.width - globalWidth, options.background);
  for (let x = 0; x < command.width; x += 1) surface.set(x, LOCAL_ROW, command.get(x, LOCAL_ROW));
  if (compact) {
    paintLine(surface, `${GAP}${options.presentation.globalCompact}`, { row: LOCAL_ROW, x: options.width - globalWidth, width: globalWidth }, options.background);
  }
}

function paintLine(surface: Surface, text: string, bounds: { row: number; x: number; width: number }, token: JeditStyleToken): void {
  const { row, x, width } = bounds;
  const line = stringToSurface(fitLine(text, width), width, ONE_ROW);
  for (let column = 0; column < line.width; column += 1) {
    const cell = line.get(column, 0);
    line.set(column, 0, { ...cell, fg: token.fg, fgRGB: token.fgRGB, bg: token.bg, bgRGB: token.bgRGB });
  }
  surface.blit(line, x, row);
}

export function joinFooterSides(left: string, right: string, width: number): string {
  if (right.length === 0) return clipToWidth(left, width);
  const rightWidth = Math.min(visibleLineLength(right), Math.floor(width / 2));
  const leftWidth = Math.max(0, width - rightWidth - GAP.length);
  return `${fitLine(left, leftWidth)}${GAP}${clipToWidth(right, rightWidth)}`;
}
