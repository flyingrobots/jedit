import { createSurface, stringToSurface, type Surface } from "@flyingrobots/bijou";
import type { JeditStyleToken } from "./jedit-theme.js";
import { visibleLineLength } from "./fit-line.js";
import {
  applyBackground,
  fillSurface,
  fitLine,
} from "./workspace-footer-surface-utils.js";

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
  return visibleLineLength(editorPath) + FOOTER_POSTURE_GAP + visibleLineLength(posture) <= width;
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
  const postureWidth = visibleLineLength(posture);
  const pathWidth = Math.max(0, width - postureWidth - FOOTER_POSTURE_GAP);
  const pathLine = stringToSurface(fitLine(editorPath, pathWidth), pathWidth, FOOTER_LINE_HEIGHT);
  const postureLine = stringToSurface(posture, postureWidth, FOOTER_LINE_HEIGHT);
  applyBackground(pathLine, background);
  applyBackground(postureLine, background);
  surface.blit(pathLine, FOOTER_ORIGIN, FOOTER_PRIMARY_ROW);
  surface.blit(postureLine, width - postureLine.width, FOOTER_PRIMARY_ROW);
  return { surface, x: FOOTER_ORIGIN };
}

function editorFooterPostureText(textPosture: string): string {
  return `[${textPosture}]`;
}
