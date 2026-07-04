import { stringToSurface, type Surface } from '@flyingrobots/bijou';
import { clipToWidth } from '@flyingrobots/bijou-tui';
import { I18N_TEXT_DIRECTION, type I18nPort } from '../ports/i18n.js';
import type { JeditStyleToken } from './jedit-theme.js';
import { visibleLineLength } from './fit-line.js';
import {
  applyBackground,
  fillSurface,
  fitLine,
} from './workspace-footer-surface-utils.js';
import {
  editorFooterPostureFits,
  rightAlignedEditorPostureLineSurface,
} from './workspace-footer-posture-line.js';

const FOOTER_LINE_HEIGHT = 1;
const FOOTER_ORIGIN = 0;
const MIN_FOOTER_CONTENT_WIDTH = 1;

export interface WorkspaceFooterSecondaryLineState {
  readonly direction: I18nPort['direction'];
  readonly rightAlignPosture: boolean;
  readonly editorPath?: string;
  readonly textPosture?: string;
}

export function fillFooterSurface(surface: Surface, token: JeditStyleToken): void {
  fillSurface(surface, token);
}

export function footerLineSurface(
  text: string,
  width: number,
  background: JeditStyleToken,
  direction: I18nPort['direction'],
): { readonly surface: Surface; readonly x: number } {
  const content = footerLineContent(text, width);
  const contentWidth = Math.max(MIN_FOOTER_CONTENT_WIDTH, Math.min(width, visibleLineLength(content)));
  const lineSurface = stringToSurface(fitLine(content, contentWidth), contentWidth, FOOTER_LINE_HEIGHT);
  applyBackground(lineSurface, background);

  return {
    surface: lineSurface,
    x: direction === I18N_TEXT_DIRECTION.Rtl ? width - lineSurface.width : FOOTER_ORIGIN,
  };
}

export function footerSecondaryLineSurface(
  state: WorkspaceFooterSecondaryLineState,
  fallbackText: string,
  width: number,
  background: JeditStyleToken,
): { readonly surface: Surface; readonly x: number } {
  return shouldRightAlignEditorPosture(state, width)
    ? rightAlignedEditorPostureLineSurface(
      state.editorPath,
      state.textPosture,
      width,
      background,
    )
    : footerLineSurface(fallbackText, width, background, state.direction);
}

function shouldRightAlignEditorPosture(
  state: WorkspaceFooterSecondaryLineState,
  width: number,
): state is WorkspaceFooterSecondaryLineState & {
  readonly editorPath: string;
  readonly textPosture: string;
} {
  return state.direction !== I18N_TEXT_DIRECTION.Rtl &&
    state.rightAlignPosture &&
    state.editorPath != null &&
    state.textPosture != null &&
    editorFooterPostureFits(state.editorPath, state.textPosture, width);
}

function footerLineContent(text: string, width: number): string {
  const clipped = clipToWidth(text, width).trimEnd();
  return clipped.length > 0 ? clipped : ' ';
}
