import { stringToSurface, type Surface } from '@flyingrobots/bijou';
import { clipToWidth } from '@flyingrobots/bijou-tui';
import type { I18nPort } from '../ports/i18n.js';
import type { JeditStyleToken } from './jedit-theme.js';
import {
  editorFooterPostureFits,
  rightAlignedEditorPostureLineSurface,
} from './workspace-footer-posture-line.js';

const FOOTER_LINE_HEIGHT = 1;
const FOOTER_ORIGIN = 0;
const MIN_FOOTER_CONTENT_WIDTH = 1;
const TEXT_DIRECTION_RTL = 'rtl';

export interface WorkspaceFooterSecondaryLineState {
  readonly direction: I18nPort['direction'];
  readonly rightAlignPosture: boolean;
  readonly editorPath?: string;
  readonly textPosture?: string;
}

export function fillFooterSurface(surface: Surface, token: JeditStyleToken): void {
  surface.fill({
    char: ' ',
    bg: token.bg,
    bgRGB: token.bgRGB,
    empty: false,
  });
}

export function footerLineSurface(
  text: string,
  width: number,
  background: JeditStyleToken,
  direction: I18nPort['direction'],
): { readonly surface: Surface; readonly x: number } {
  const content = footerLineContent(text, width);
  const contentWidth = Math.max(MIN_FOOTER_CONTENT_WIDTH, Math.min(width, [...content].length));
  const lineSurface = stringToSurface(fitLine(content, contentWidth), contentWidth, FOOTER_LINE_HEIGHT);
  applyBackground(lineSurface, background);

  return {
    surface: lineSurface,
    x: direction === TEXT_DIRECTION_RTL ? width - lineSurface.width : FOOTER_ORIGIN,
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
  return state.direction !== TEXT_DIRECTION_RTL &&
    state.rightAlignPosture &&
    state.editorPath != null &&
    state.textPosture != null &&
    editorFooterPostureFits(state.editorPath, state.textPosture, width);
}

function applyBackground(surface: Surface, token: JeditStyleToken): void {
  for (let y = 0; y < surface.height; y += 1) {
    for (let x = 0; x < surface.width; x += 1) {
      const cell = surface.get(x, y);
      surface.set(x, y, {
        ...cell,
        char: cell.char.length > 0 ? cell.char : ' ',
        bg: token.bg,
        bgRGB: token.bgRGB,
        empty: false,
      });
    }
  }
}

function fitLine(text: string, width: number): string {
  const clipped = clipToWidth(text, width);
  const visible = [...clipped].length;
  if (visible >= width) {
    return clipped;
  }

  return clipped.padEnd(width, ' ');
}

function footerLineContent(text: string, width: number): string {
  const clipped = clipToWidth(text, width).trimEnd();
  return clipped.length > 0 ? clipped : ' ';
}
