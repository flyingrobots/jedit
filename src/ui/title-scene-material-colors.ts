import { type RGB } from "./averaging-braille-canvas.js";
import { type JeditTheme } from "./jedit-theme.js";
import { TITLE_SCENE_LIGHTING_VARIABLE } from "./title-scene-lighting-tokens.js";

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
  readonly spotlight: Color3;
}

const LUMINANCE_RED_WEIGHT = 0.2126;
const LUMINANCE_GREEN_WEIGHT = 0.7152;
const LUMINANCE_BLUE_WEIGHT = 0.0722;
const TITLE_SCENE_ACCENT_VARIABLE = "accent";
const TITLE_SCENE_INFO_VARIABLE = "info";
const TITLE_SCENE_SUCCESS_VARIABLE = "success";
const TITLE_SCENE_INK_VARIABLE = "ink";
const TITLE_SCENE_MUTED_VARIABLE = "muted";
const TITLE_SCENE_SURFACE_VARIABLE = "surface";
const TITLE_SCENE_ACCENT_COLOR: Color3 = [224, 113, 63];
const TITLE_SCENE_INFO_COLOR: Color3 = [78, 195, 224];
const TITLE_SCENE_SUCCESS_COLOR: Color3 = [112, 216, 167];
const TITLE_SCENE_INK_COLOR: Color3 = [222, 232, 232];
const TITLE_SCENE_MUTED_COLOR: Color3 = [55, 75, 88];
const TITLE_SCENE_SURFACE_COLOR: Color3 = [5, 7, 12];

export function titleSceneMaterialColors(
  theme: JeditTheme,
): TitleSceneMaterialColors {
  const baseColors = titleSceneBaseColors(theme);
  const floorColors = titleSceneFloorMaterialColors(theme, baseColors);

  return {
    ...baseColors,
    floorDark: floorColors.dark,
    floorLight: floorColors.light,
  };
}

function titleSceneBaseColors(
  theme: JeditTheme,
): Omit<TitleSceneMaterialColors, "floorDark" | "floorLight"> {
  const palette = titleSceneBasePalette(theme);
  return {
    ...palette,
    spotlight: titleSceneThemeColor(
      theme,
      TITLE_SCENE_LIGHTING_VARIABLE.Spotlight,
      palette.accent,
    ),
  };
}

function titleSceneBasePalette(
  theme: JeditTheme,
): Omit<TitleSceneMaterialColors, "floorDark" | "floorLight" | "spotlight"> {
  const accent = titleSceneThemeColor(
    theme,
    TITLE_SCENE_ACCENT_VARIABLE,
    TITLE_SCENE_ACCENT_COLOR,
  );
  return {
    accent,
    info: titleSceneThemeColor(
      theme,
      TITLE_SCENE_INFO_VARIABLE,
      TITLE_SCENE_INFO_COLOR,
    ),
    success: titleSceneThemeColor(
      theme,
      TITLE_SCENE_SUCCESS_VARIABLE,
      TITLE_SCENE_SUCCESS_COLOR,
    ),
    ink: titleSceneThemeColor(
      theme,
      TITLE_SCENE_INK_VARIABLE,
      TITLE_SCENE_INK_COLOR,
    ),
    muted: titleSceneThemeColor(
      theme,
      TITLE_SCENE_MUTED_VARIABLE,
      TITLE_SCENE_MUTED_COLOR,
    ),
    surface: titleSceneThemeColor(
      theme,
      TITLE_SCENE_SURFACE_VARIABLE,
      TITLE_SCENE_SURFACE_COLOR,
    ),
  };
}

function titleSceneThemeColor(
  theme: JeditTheme,
  variableName: string,
  fallback: Color3,
): Color3 {
  return theme.variables.get(variableName)?.rgb ?? fallback;
}

function titleSceneFloorMaterialColors(
  theme: JeditTheme,
  baseColors: Pick<TitleSceneMaterialColors, "ink" | "muted">,
): { readonly dark: Color3; readonly light: Color3 } {
  const dark = theme.variables.get(
    TITLE_SCENE_LIGHTING_VARIABLE.FloorDark,
  )?.rgb;
  const light = theme.variables.get(
    TITLE_SCENE_LIGHTING_VARIABLE.FloorLight,
  )?.rgb;
  return dark == null || light == null
    ? orderedFloorMaterialColors(baseColors.ink, baseColors.muted)
    : { dark, light };
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
  return (
    color[0] * LUMINANCE_RED_WEIGHT +
    color[1] * LUMINANCE_GREEN_WEIGHT +
    color[2] * LUMINANCE_BLUE_WEIGHT
  );
}
