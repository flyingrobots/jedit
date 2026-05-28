import { createSurface, stringToSurface, type Surface } from '@flyingrobots/bijou';
import { JEDIT_SCENE_PICKER_TOGGLE_LABEL } from '../app/keybindings.js';
import { JEDIT_MARKDOWN_TOKEN, type JeditStyleToken, type JeditTheme } from './jedit-theme.js';
import { fitLine } from './workspace-render.js';

const SCENE_PICKER_DRAWER_MIN_WIDTH = 28;
const SCENE_PICKER_DRAWER_MAX_WIDTH = 42;
const SCENE_PICKER_DRAWER_WIDTH_RATIO = 0.3;
const SCENE_PICKER_HEADER_ROW = 1;
const SCENE_PICKER_HINT_ROW = 2;
const SCENE_PICKER_FIRST_ROW = 4;
const SCENE_PICKER_LEFT_PAD = 2;
const SCENE_PICKER_ROW_HEIGHT = 1;
const SCENE_PICKER_SELECTED_MARK = '›';
const SCENE_PICKER_UNSELECTED_MARK = ' ';
const SCENE_PICKER_CLOSE_HINT = `${JEDIT_SCENE_PICKER_TOGGLE_LABEL.toUpperCase()}/Esc close, Enter load`;
const SCENE_PICKER_TITLE = 'Load Scene';

export interface RenderScenePickerDrawerOptions {
  readonly scenes: readonly string[];
  readonly selectedIndex: number;
  readonly theme: JeditTheme;
  readonly width: number;
  readonly height: number;
}

export function resolveScenePickerDrawerWidth(columns: number): number {
  const boundedColumns = Math.max(SCENE_PICKER_DRAWER_MIN_WIDTH, columns);
  return Math.min(
    Math.max(SCENE_PICKER_DRAWER_MIN_WIDTH, Math.floor(boundedColumns * SCENE_PICKER_DRAWER_WIDTH_RATIO)),
    Math.max(SCENE_PICKER_DRAWER_MIN_WIDTH, boundedColumns - SCENE_PICKER_LEFT_PAD),
    SCENE_PICKER_DRAWER_MAX_WIDTH,
  );
}

export function renderScenePickerDrawer(options: RenderScenePickerDrawerOptions): Surface {
  const surface = createSurface(options.width, options.height);
  fillSurface(surface, options.theme.surface.drawer);
  paintText(surface, SCENE_PICKER_TITLE, SCENE_PICKER_LEFT_PAD, SCENE_PICKER_HEADER_ROW, scenePickerTitleToken(options));
  paintText(surface, SCENE_PICKER_CLOSE_HINT, SCENE_PICKER_LEFT_PAD, SCENE_PICKER_HINT_ROW, options.theme.surface.drawer);

  let y = SCENE_PICKER_FIRST_ROW;
  for (let index = 0; index < options.scenes.length && y < options.height; index += 1) {
    const scene = options.scenes[index];
    if (scene == null) continue;
    const selected = index === options.selectedIndex;
    const label = fitLine(scenePickerRowLabel({ selected, scene }), Math.max(1, options.width - SCENE_PICKER_LEFT_PAD));
    const token = selected ? options.theme.cursor.normal : options.theme.surface.drawer;
    paintText(surface, label, SCENE_PICKER_LEFT_PAD, y, token);
    y += SCENE_PICKER_ROW_HEIGHT;
  }
  return surface;
}

function scenePickerTitleToken(options: RenderScenePickerDrawerOptions): JeditStyleToken {
  return options.theme.markdown.get(JEDIT_MARKDOWN_TOKEN.Heading) ?? options.theme.surface.drawer;
}

function scenePickerRowLabel(options: { readonly selected: boolean; readonly scene: string }): string {
  return `${options.selected ? SCENE_PICKER_SELECTED_MARK : SCENE_PICKER_UNSELECTED_MARK} ${options.scene}`;
}

function paintText(surface: Surface, text: string, x: number, y: number, token: JeditStyleToken): void {
  if (y < 0 || y >= surface.height || x >= surface.width) {
    return;
  }
  const width = Math.max(1, surface.width - x);
  const line = stringToSurface(fitLine(text, width), width, 1);
  applyToken(line, token);
  surface.blit(line, x, y);
}

function fillSurface(surface: Surface, token: JeditStyleToken): void {
  surface.fill({
    char: ' ',
    fg: token.fg,
    bg: token.bg,
    fgRGB: token.fgRGB,
    bgRGB: token.bgRGB,
    empty: false,
  });
}

function applyToken(surface: Surface, token: JeditStyleToken): void {
  for (let y = 0; y < surface.height; y += 1) {
    for (let x = 0; x < surface.width; x += 1) {
      const cell = surface.get(x, y);
      surface.set(x, y, {
        ...cell,
        fg: token.fg ?? cell.fg,
        bg: token.bg ?? cell.bg,
        fgRGB: token.fgRGB ?? cell.fgRGB,
        bgRGB: token.bgRGB ?? cell.bgRGB,
        modifiers: token.modifiers == null ? cell.modifiers : [...token.modifiers],
        empty: false,
      });
    }
  }
}
