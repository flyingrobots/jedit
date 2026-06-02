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

export function titleSceneMaterialColors(theme: JeditTheme): TitleSceneMaterialColors {
  const baseColors = fixedTitleSceneBaseColors(theme);
  const floorColors = orderedFloorMaterialColors(baseColors.ink, baseColors.muted);

  return {
    ...baseColors,
    floorDark: floorColors.dark,
    floorLight: floorColors.light,
  };
}

function fixedTitleSceneBaseColors(_theme: JeditTheme): Omit<TitleSceneMaterialColors, 'floorDark' | 'floorLight'> {
  return {
    accent: [224, 113, 63],
    info: [78, 195, 224],
    success: [112, 216, 167],
    ink: [222, 232, 232],
    muted: [55, 75, 88],
    surface: [5, 7, 12],
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
