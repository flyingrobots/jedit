import { type RGB } from './averaging-braille-canvas.js';
import { type JeditTheme } from './jedit-theme.js';

type Color3 = RGB;

export interface TitleSceneMaterialColors {
  readonly accent: Color3;
  readonly info: Color3;
  readonly success: Color3;
  readonly ink: Color3;
  readonly muted: Color3;
  readonly surface: Color3;
  readonly floorDark: Color3;
  readonly floorLight: Color3;
}

const LUMINANCE_RED_WEIGHT = 0.2126;
const LUMINANCE_GREEN_WEIGHT = 0.7152;
const LUMINANCE_BLUE_WEIGHT = 0.0722;
const TITLE_SCENE_ACCENT_COLOR: Color3 = [224, 113, 63];
const TITLE_SCENE_INFO_COLOR: Color3 = [78, 195, 224];
const TITLE_SCENE_SUCCESS_COLOR: Color3 = [112, 216, 167];
const TITLE_SCENE_INK_COLOR: Color3 = [222, 232, 232];
const TITLE_SCENE_MUTED_COLOR: Color3 = [55, 75, 88];
const TITLE_SCENE_SURFACE_COLOR: Color3 = [5, 7, 12];

export function titleSceneMaterialColors(_theme: JeditTheme): TitleSceneMaterialColors {
  const baseColors = fixedTitleSceneBaseColors();
  const floorColors = orderedFloorMaterialColors(baseColors.ink, baseColors.muted);

  return {
    ...baseColors,
    floorDark: floorColors.dark,
    floorLight: floorColors.light,
  };
}

function fixedTitleSceneBaseColors(): Omit<TitleSceneMaterialColors, 'floorDark' | 'floorLight'> {
  return {
    accent: TITLE_SCENE_ACCENT_COLOR,
    info: TITLE_SCENE_INFO_COLOR,
    success: TITLE_SCENE_SUCCESS_COLOR,
    ink: TITLE_SCENE_INK_COLOR,
    muted: TITLE_SCENE_MUTED_COLOR,
    surface: TITLE_SCENE_SURFACE_COLOR,
  };
}

function orderedFloorMaterialColors(
  first: Color3,
  second: Color3,
): { readonly dark: Color3; readonly light: Color3 } {
  return titleColorLuminance(first) <= titleColorLuminance(second)
    ? { dark: first, light: second }
    : { dark: second, light: first };
}

export function titleColorLuminance(color: Color3): number {
  return (color[0] * LUMINANCE_RED_WEIGHT)
    + (color[1] * LUMINANCE_GREEN_WEIGHT)
    + (color[2] * LUMINANCE_BLUE_WEIGHT);
}
