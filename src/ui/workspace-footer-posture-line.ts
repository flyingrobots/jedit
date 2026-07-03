import { createSurface, stringToSurface, type Surface } from "@flyingrobots/bijou";
import { clipToWidth } from "@flyingrobots/bijou-tui";
import type { JeditStyleToken } from "./jedit-theme.js";

const FOOTER_LINE_HEIGHT = 1;
const FOOTER_ORIGIN = 0;
const FOOTER_PRIMARY_ROW = 0;
const FOOTER_POSTURE_GAP = 1;

export function editorFooterPostureFits(
  editorPath: string,
  textPosture: string,
  width: number,
): boolean {
  const posture = editorFooterPostureText(textPosture);
  return [...editorPath].length + FOOTER_POSTURE_GAP + [...posture].length <= width;
}

export function rightAlignedEditorPostureLineSurface(
  editorPath: string,
  textPosture: string,
  width: number,
  background: JeditStyleToken,
): { readonly surface: Surface; readonly x: number } {
  const surface = createSurface(width, FOOTER_LINE_HEIGHT);
  fillSurface(surface, background);
  const posture = editorFooterPostureText(textPosture);
  const pathWidth = Math.max(0, width - [...posture].length - FOOTER_POSTURE_GAP);
  const pathLine = stringToSurface(fitLine(editorPath, pathWidth), pathWidth, FOOTER_LINE_HEIGHT);
  const postureLine = stringToSurface(posture, [...posture].length, FOOTER_LINE_HEIGHT);
  applyBackground(pathLine, background);
  applyBackground(postureLine, background);
  surface.blit(pathLine, FOOTER_ORIGIN, FOOTER_PRIMARY_ROW);
  surface.blit(postureLine, width - postureLine.width, FOOTER_PRIMARY_ROW);
  return { surface, x: FOOTER_ORIGIN };
}

function editorFooterPostureText(textPosture: string): string {
  return `[${textPosture}]`;
}

function fillSurface(surface: Surface, token: JeditStyleToken): void {
  surface.fill({
    char: " ",
    bg: token.bg,
    bgRGB: token.bgRGB,
    empty: false,
  });
}

function applyBackground(surface: Surface, token: JeditStyleToken): void {
  for (let y = 0; y < surface.height; y += 1) {
    for (let x = 0; x < surface.width; x += 1) {
      const cell = surface.get(x, y);
      surface.set(x, y, {
        ...cell,
        char: cell.char.length > 0 ? cell.char : " ",
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

  return clipped.padEnd(width, " ");
}
