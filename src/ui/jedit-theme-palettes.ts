import {
  JEDIT_THEME_MODE,
  type JeditThemeMode,
  type JeditThemeVariantSource,
} from "./jedit-theme.js";

export type RgbTuple = readonly [number, number, number];

export interface ThemePalette {
  readonly ink: RgbTuple;
  readonly muted: RgbTuple;
  readonly accent: RgbTuple;
  readonly info: RgbTuple;
  readonly warning: RgbTuple;
  readonly success: RgbTuple;
  readonly surface: RgbTuple;
  readonly surfaceRaised: RgbTuple;
  readonly surfaceMuted: RgbTuple;
}

export interface TitleSceneLightingPalette {
  readonly spotlight?: RgbTuple;
  readonly floorDark?: RgbTuple;
  readonly floorLight?: RgbTuple;
}

export interface PaletteThemeOptions {
  readonly mode: JeditThemeMode;
  readonly familyName?: string;
  readonly variantSource?: JeditThemeVariantSource;
  readonly companionThemeName?: string;
  readonly titleSceneLighting?: TitleSceneLightingPalette;
}

export interface BuiltInPaletteThemeDefinition {
  readonly name: string;
  readonly palette: ThemePalette;
  readonly options: PaletteThemeOptions;
}

const GRAPHITE_THEME_NAME = "graphite";
const MORNING_THEME_NAME = "morning";
const MONOKAI_THEME_NAME = "monokai";
const SOLARIZED_DARK_THEME_NAME = "solarized-dark";
const SOLARIZED_LIGHT_THEME_NAME = "solarized-light";
const DRACULA_THEME_NAME = "dracula";
const NORD_THEME_NAME = "nord";
const CATPPUCCIN_THEME_NAME = "catppuccin";
const SOLARIZED_FAMILY_NAME = "solarized";

const GRAPHITE_PALETTE: ThemePalette = {
  ink: [226, 231, 236],
  muted: [126, 137, 148],
  accent: [216, 151, 255],
  info: [101, 194, 255],
  warning: [245, 184, 92],
  success: [124, 213, 156],
  surface: [14, 17, 22],
  surfaceRaised: [28, 32, 40],
  surfaceMuted: [22, 26, 33],
};

const MORNING_PALETTE: ThemePalette = {
  ink: [34, 39, 46],
  muted: [112, 118, 126],
  accent: [170, 79, 31],
  info: [37, 118, 145],
  warning: [146, 95, 23],
  success: [53, 124, 84],
  surface: [244, 241, 232],
  surfaceRaised: [232, 228, 217],
  surfaceMuted: [222, 218, 208],
};

const MONOKAI_PALETTE: ThemePalette = {
  ink: [248, 248, 242],
  muted: [117, 113, 94],
  accent: [249, 38, 114],
  info: [102, 217, 239],
  warning: [253, 151, 31],
  success: [166, 226, 46],
  surface: [39, 40, 34],
  surfaceRaised: [49, 50, 43],
  surfaceMuted: [58, 59, 50],
};

const MONOKAI_TITLE_SCENE_LIGHTING: TitleSceneLightingPalette = {
  spotlight: [102, 217, 239],
  floorDark: [39, 40, 34],
  floorLight: [117, 113, 94],
};

const SOLARIZED_DARK_PALETTE: ThemePalette = {
  ink: [238, 232, 213],
  muted: [131, 148, 150],
  accent: [211, 54, 130],
  info: [38, 139, 210],
  warning: [181, 137, 0],
  success: [133, 153, 0],
  surface: [0, 43, 54],
  surfaceRaised: [7, 54, 66],
  surfaceMuted: [1, 36, 45],
};

const SOLARIZED_LIGHT_PALETTE: ThemePalette = {
  ink: [79, 98, 104],
  muted: [147, 161, 161],
  accent: [211, 54, 130],
  info: [38, 139, 210],
  warning: [181, 137, 0],
  success: [133, 153, 0],
  surface: [253, 246, 227],
  surfaceRaised: [238, 232, 213],
  surfaceMuted: [238, 232, 213],
};

const DRACULA_PALETTE: ThemePalette = {
  ink: [248, 248, 242],
  muted: [98, 114, 164],
  accent: [189, 147, 249],
  info: [139, 233, 253],
  warning: [255, 184, 108],
  success: [80, 250, 123],
  surface: [40, 42, 54],
  surfaceRaised: [68, 71, 90],
  surfaceMuted: [50, 52, 67],
};

const NORD_PALETTE: ThemePalette = {
  ink: [216, 222, 233],
  muted: [136, 151, 168],
  accent: [180, 142, 173],
  info: [136, 192, 208],
  warning: [235, 203, 139],
  success: [163, 190, 140],
  surface: [46, 52, 64],
  surfaceRaised: [59, 66, 82],
  surfaceMuted: [67, 76, 94],
};

const CATPPUCCIN_PALETTE: ThemePalette = {
  ink: [205, 214, 244],
  muted: [147, 153, 178],
  accent: [203, 166, 247],
  info: [137, 180, 250],
  warning: [249, 226, 175],
  success: [166, 227, 161],
  surface: [30, 30, 46],
  surfaceRaised: [49, 50, 68],
  surfaceMuted: [69, 71, 90],
};

export const DEFAULT_PALETTE_THEME_DEFINITION: BuiltInPaletteThemeDefinition = {
  name: GRAPHITE_THEME_NAME,
  palette: GRAPHITE_PALETTE,
  options: { mode: JEDIT_THEME_MODE.Dark },
};

export const BUILT_IN_PALETTE_THEME_DEFINITIONS: readonly BuiltInPaletteThemeDefinition[] =
  [
    DEFAULT_PALETTE_THEME_DEFINITION,
    {
      name: MORNING_THEME_NAME,
      palette: MORNING_PALETTE,
      options: { mode: JEDIT_THEME_MODE.Light },
    },
    {
      name: MONOKAI_THEME_NAME,
      palette: MONOKAI_PALETTE,
      options: {
        mode: JEDIT_THEME_MODE.Dark,
        titleSceneLighting: MONOKAI_TITLE_SCENE_LIGHTING,
      },
    },
    {
      name: SOLARIZED_DARK_THEME_NAME,
      palette: SOLARIZED_DARK_PALETTE,
      options: {
        mode: JEDIT_THEME_MODE.Dark,
        familyName: SOLARIZED_FAMILY_NAME,
        companionThemeName: SOLARIZED_LIGHT_THEME_NAME,
      },
    },
    {
      name: SOLARIZED_LIGHT_THEME_NAME,
      palette: SOLARIZED_LIGHT_PALETTE,
      options: {
        mode: JEDIT_THEME_MODE.Light,
        familyName: SOLARIZED_FAMILY_NAME,
        companionThemeName: SOLARIZED_DARK_THEME_NAME,
      },
    },
    {
      name: DRACULA_THEME_NAME,
      palette: DRACULA_PALETTE,
      options: { mode: JEDIT_THEME_MODE.Dark },
    },
    {
      name: NORD_THEME_NAME,
      palette: NORD_PALETTE,
      options: { mode: JEDIT_THEME_MODE.Dark },
    },
    {
      name: CATPPUCCIN_THEME_NAME,
      palette: CATPPUCCIN_PALETTE,
      options: { mode: JEDIT_THEME_MODE.Dark },
    },
  ];
