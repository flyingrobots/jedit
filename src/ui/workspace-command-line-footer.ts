import { createSurface, stringToSurface, type Surface } from "@flyingrobots/bijou";
import { clipToWidth } from "@flyingrobots/bijou-tui";
import type { I18nPort } from "../ports/i18n.js";
import { JEDIT_TEXT_MODIFIER, type JeditStyleToken } from "./jedit-theme.js";
import { visibleLineLength } from "./fit-line.js";
import {
  applyBackground,
  fillSurface,
  fitLine,
} from "./workspace-footer-surface-utils.js";

const COMMAND_LINE_INVALID_KIND = "invalid";
const COMMAND_LINE_INVALID_MESSAGE_KEY = "footer.command.invalid";
const COMMAND_LINE_HINT_TAB_ACCEPT_KEY = "footer.command.hints.tab_accept";
const COMMAND_LINE_HINT_ENTER_RUN_KEY = "footer.command.hints.enter_run";
const COMMAND_LINE_HINT_ESC_CANCEL_KEY = "footer.command.hints.esc_cancel";
const COMMAND_LINE_PREFIX = ":";
const COMMAND_LINE_INVALID_SEPARATOR = "  ";
const FOOTER_HINT_SEPARATOR = " · ";
const FOOTER_LINE_HEIGHT = 1;
const FOOTER_ORIGIN = 0;
const FOOTER_PRIMARY_ROW = 0;
const FOOTER_ROWS = 2;
const FOOTER_SECONDARY_ROW = 1;
const MIN_FOOTER_CONTENT_WIDTH = 1;
const TEXT_DIRECTION_RTL = "rtl";

interface CommandLineDispatchPosture {
  readonly kind: string;
  readonly input: string;
}

export interface WorkspaceCommandLineFooterState {
  readonly active: boolean;
  readonly input: string;
  readonly dispatchPosture?: CommandLineDispatchPosture;
}

export interface WorkspaceCommandLineFooterRenderState {
  readonly i18n: I18nPort;
  readonly commandLine: WorkspaceCommandLineFooterState;
  readonly contextLine: string;
  readonly commandLineError?: JeditStyleToken;
}

interface FooterLine {
  readonly surface: Surface;
  readonly x: number;
}

interface FooterStyleRange {
  readonly start: number;
  readonly end: number;
  readonly token: JeditStyleToken;
}

export function renderWorkspaceCommandLineFooter(
  state: WorkspaceCommandLineFooterRenderState,
  width: number,
  background: JeditStyleToken,
): Surface {
  const surface = createSurface(width, FOOTER_ROWS);
  fillSurface(surface, background);
  if (width <= FOOTER_ORIGIN) {
    return surface;
  }

  const primary = commandLinePrimaryLine(state, width, background);
  const secondary = footerLineSurface(
    state.contextLine,
    [],
    width,
    background,
    state.i18n.direction,
  );
  surface.blit(primary.surface, primary.x, FOOTER_PRIMARY_ROW);
  surface.blit(secondary.surface, secondary.x, FOOTER_SECONDARY_ROW);
  return surface;
}

export function workspaceCommandLineFooterHintLine(i18n: I18nPort): string {
  return `[${[
    i18n.t(COMMAND_LINE_HINT_TAB_ACCEPT_KEY),
    i18n.t(COMMAND_LINE_HINT_ENTER_RUN_KEY),
    i18n.t(COMMAND_LINE_HINT_ESC_CANCEL_KEY),
  ].join(FOOTER_HINT_SEPARATOR)}]`;
}

function commandLinePrimaryLine(
  state: WorkspaceCommandLineFooterRenderState,
  width: number,
  background: JeditStyleToken,
): FooterLine {
  return commandLineInvalid(state)
    ? invalidCommandLineSurface(state, width, background)
    : footerLineSurface(
        `${COMMAND_LINE_PREFIX}${state.commandLine.input}`,
        [],
        width,
        background,
        state.i18n.direction,
      );
}

function invalidCommandLineSurface(
  state: WorkspaceCommandLineFooterRenderState,
  width: number,
  background: JeditStyleToken,
): FooterLine {
  const message = state.i18n.t(COMMAND_LINE_INVALID_MESSAGE_KEY);
  const text = [
    COMMAND_LINE_PREFIX,
    state.commandLine.input,
    COMMAND_LINE_INVALID_SEPARATOR,
    message,
  ].join("");
  return footerLineSurface(
    text,
    invalidCommandLineStyleRanges(state, message, background),
    width,
    background,
    state.i18n.direction,
  );
}

function invalidCommandLineStyleRanges(
  state: WorkspaceCommandLineFooterRenderState,
  message: string,
  background: JeditStyleToken,
): readonly FooterStyleRange[] {
  const inputStart = COMMAND_LINE_PREFIX.length;
  const inputEnd = inputStart + state.commandLine.input.length;
  const messageStart = inputEnd + COMMAND_LINE_INVALID_SEPARATOR.length;
  return [
    {
      start: inputStart,
      end: inputEnd,
      token: state.commandLineError ?? background,
    },
    {
      start: messageStart,
      end: messageStart + message.length,
      token: invalidMessageToken(background),
    },
  ];
}

function invalidMessageToken(background: JeditStyleToken): JeditStyleToken {
  return {
    ...background,
    modifiers: [JEDIT_TEXT_MODIFIER.Dim],
  };
}

function commandLineInvalid(
  state: WorkspaceCommandLineFooterRenderState,
): boolean {
  return state.commandLine.dispatchPosture?.kind === COMMAND_LINE_INVALID_KIND;
}

function footerLineSurface(
  text: string,
  ranges: readonly FooterStyleRange[],
  width: number,
  background: JeditStyleToken,
  direction: I18nPort["direction"],
): FooterLine {
  const content = footerLineContent(text, width);
  const contentWidth = Math.max(
    MIN_FOOTER_CONTENT_WIDTH,
    Math.min(width, visibleLineLength(content)),
  );
  const lineSurface = stringToSurface(
    fitLine(content, contentWidth),
    contentWidth,
    FOOTER_LINE_HEIGHT,
  );
  applyBackground(lineSurface, background);
  applyStyleRanges(lineSurface, ranges);

  return {
    surface: lineSurface,
    x: direction === TEXT_DIRECTION_RTL
      ? width - lineSurface.width
      : FOOTER_ORIGIN,
  };
}

function applyStyleRanges(
  surface: Surface,
  ranges: readonly FooterStyleRange[],
): void {
  for (const range of ranges) {
    applyStyleRange(surface, range);
  }
}

function applyStyleRange(surface: Surface, range: FooterStyleRange): void {
  for (let x = range.start; x < Math.min(range.end, surface.width); x += 1) {
    if (x >= FOOTER_ORIGIN) {
      const cell = surface.get(x, FOOTER_ORIGIN);
      surface.set(x, FOOTER_ORIGIN, {
        ...cell,
        fg: range.token.fg ?? cell.fg,
        fgRGB: range.token.fgRGB ?? cell.fgRGB,
        bg: range.token.bg ?? cell.bg,
        bgRGB: range.token.bgRGB ?? cell.bgRGB,
        modifiers:
          range.token.modifiers == null
            ? cell.modifiers
            : [...range.token.modifiers],
      });
    }
  }
}

function footerLineContent(text: string, width: number): string {
  const clipped = clipToWidth(text, width).trimEnd();
  return clipped.length > 0 ? clipped : " ";
}
