import { createSurface, stringToSurface, type Surface } from '@flyingrobots/bijou';
import { clipToWidth } from '@flyingrobots/bijou-tui';
import type { JeditStyleToken } from './jedit-theme.js';
import { applyFooterRange, emphasizeFooterPhrases } from './footer-cell-style.js';
import { renderFileSearchInput, type FileSearchInputOptions } from './file-search-input.js';
import { FOOTER_LAYOUT, footerLayoutRows, footerGlobalWidth, type FooterLayout } from './footer-layout.js';
import { visibleLineLength, fitLine } from './fit-line.js';
import { renderWorkspaceCommandLineFooter, type WorkspaceCommandLineFooterRenderState } from './workspace-command-line-footer.js';

export interface FooterSurfaceObservation {
  readonly label: string;
  readonly emphasis?: string;
  readonly detailEmphasized?: boolean;
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
  readonly normalToken: JeditStyleToken;
  readonly mutedToken: JeditStyleToken;
  readonly globalEmphasis: readonly string[];
  readonly filterInput?: FileSearchInputOptions;
  readonly hidden?: boolean;
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
  options = { ...options, background: options.presentation.mutedToken };
  const { presentation, width, background } = options;
  const surface = createSurface(width, presentation.hidden ? ONE_ROW : footerLayoutRows(presentation.layout));
  surface.fill({ char: ' ', fg: background.fg, fgRGB: background.fgRGB, bg: background.bg, bgRGB: background.bgRGB });
  if (width <= 0) return surface;
  const compact = presentation.hidden || presentation.layout === FOOTER_LAYOUT.Compact;
  if (presentation.filterInput != null) paintFilter(surface, options);
  else if (options.command != null) paintCommand(surface, options);
  else if (presentation.layout === FOOTER_LAYOUT.PerPane) paintPaneStatuses(surface, options);
  else paintLocal(surface, options);
  if (!compact) {
    paintLine(surface, joinFooterSides(presentation.workspace, presentation.globalSummary, width), { row: GLOBAL_ROW, x: 0, width }, background);
  }
  paintGlobalEmphasis(surface, options);
  return surface;
}

function paintLocal(surface: Surface, options: FooterLayoutViewOptions): void {
  const { presentation, width, background } = options;
  const compact = presentation.hidden || presentation.layout === FOOTER_LAYOUT.Compact;
  const globalWidth = footerGlobalWidth({ width, summary: presentation.globalCompact, compact });
  const localWidth = width - globalWidth;
  paintLocalObservation(surface, { ...presentation.focused, x: 0 }, localWidth, options);
  if (compact) paintLine(surface, fitLine(`${GAP}${presentation.globalCompact}`, globalWidth),
    { row: LOCAL_ROW, x: localWidth, width: globalWidth }, background);
}

function paintPaneStatuses(surface: Surface, options: FooterLayoutViewOptions): void {
  for (const observation of options.presentation.surfaces) {
    const inset = observation.x > 0 ? 1 : 0;
    if (inset > 0) paintLine(surface, '│', { row: LOCAL_ROW, x: observation.x, width: inset }, options.background);
    paintLocalObservation(surface, { ...observation, x: observation.x + inset }, observation.width - inset, options);
  }
}

function paintLocalObservation(surface: Surface, observation: FooterSurfaceObservation, width: number, options: FooterLayoutViewOptions): void {
  const text = localObservationLine(observation, width);
  paintLine(surface, text, { row: LOCAL_ROW, x: observation.x, width }, options.background);
  if (observation.active) {
    applyFooterRange(surface, { row: LOCAL_ROW, x: observation.x, width: Math.min(width, visibleLineLength(observation.label)) },
      options.presentation.activeToken);
  }
  emphasizeFooterPhrases(surface, { row: LOCAL_ROW, x: observation.x, width },
    [observation.emphasis ?? '', observation.detailEmphasized ? observation.detail : ''].filter(Boolean), options.presentation.normalToken);
}

function paintCommand(surface: Surface, options: FooterLayoutViewOptions): void {
  if (options.command == null) return;
  const compact = options.presentation.layout === FOOTER_LAYOUT.Compact;
  const globalWidth = footerGlobalWidth({ width: options.width, summary: options.presentation.globalCompact, compact });
  const command = renderWorkspaceCommandLineFooter(options.command, options.width - globalWidth, options.presentation.normalToken);
  for (let x = 0; x < command.width; x += 1) surface.set(x, LOCAL_ROW, command.get(x, LOCAL_ROW));
  if (compact) {
    paintLine(surface, `${GAP}${options.presentation.globalCompact}`,
      { row: LOCAL_ROW, x: options.width - globalWidth, width: globalWidth }, options.background);
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

function localObservationLine(observation: FooterSurfaceObservation, width: number): string {
  const detailWidth = Math.min(visibleLineLength(observation.detail), Math.floor(width / 2));
  const gapWidth = detailWidth === 0 ? 0 : GAP.length;
  const prefix = [observation.label, observation.emphasis].filter(Boolean).join(' ');
  const identityWidth = Math.max(0, width - detailWidth - gapWidth - visibleLineLength(prefix) - 1);
  const identity = tailIdentity(observation.identity, identityWidth);
  return joinFooterSides(`${prefix} ${identity}`.trimEnd(), observation.detail, width);
}

function tailIdentity(identity: string, width: number): string {
  if (width <= 0) return '';
  if (visibleLineLength(identity) <= width) return identity;
  const characters = Array.from(identity);
  while (characters.length > 0 && visibleLineLength(characters.join('')) > width - 1) characters.shift();
  return `…${characters.join('')}`;
}

function paintFilter(surface: Surface, options: FooterLayoutViewOptions): void {
  const input = options.presentation.filterInput;
  if (input == null) return;
  const compact = options.presentation.hidden || options.presentation.layout === FOOTER_LAYOUT.Compact;
  const globalWidth = footerGlobalWidth({ width: options.width, summary: options.presentation.globalCompact, compact });
  const width = options.width - globalWidth;
  surface.blit(renderFileSearchInput({ ...input, label: '/', width }), 0, LOCAL_ROW);
  if (globalWidth > 0) paintLine(surface, `${GAP}${options.presentation.globalCompact}`,
    { row: LOCAL_ROW, x: width, width: globalWidth }, options.background);
}

function paintGlobalEmphasis(surface: Surface, options: FooterLayoutViewOptions): void {
  const row = surface.height - 1;
  emphasizeFooterPhrases(surface, { row, x: 0, width: options.width }, options.presentation.globalEmphasis, options.presentation.normalToken);
  if (options.presentation.filterInput != null && row !== LOCAL_ROW) {
    emphasizeFooterPhrases(surface, { row: LOCAL_ROW, x: Math.floor(options.width / 2), width: Math.ceil(options.width / 2) },
      options.presentation.globalEmphasis, options.presentation.normalToken);
  }
}
