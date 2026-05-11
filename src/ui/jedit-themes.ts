import type { JeditTheme, JeditThemeMode, JeditThemeVariantSource } from './jedit-theme.js';
import { JEDIT_THEME_MODE, JEDIT_THEME_VARIANT_SOURCE, JEDIT_TEXT_MODIFIER } from './jedit-theme.js';
import { defineJeditTheme, type JeditThemeDraft, type ThemeColorVariable } from './theme-builder.js';

export const JEDIT_THEME_ENV = 'JEDIT_THEME';

const GRAPHITE_THEME_NAME = 'graphite';
const MORNING_THEME_NAME = 'morning';
const MONOKAI_THEME_NAME = 'monokai';
const SOLARIZED_DARK_THEME_NAME = 'solarized-dark';
const SOLARIZED_LIGHT_THEME_NAME = 'solarized-light';
const DRACULA_THEME_NAME = 'dracula';
const NORD_THEME_NAME = 'nord';
const CATPPUCCIN_THEME_NAME = 'catppuccin';
const SOLARIZED_FAMILY_NAME = 'solarized';

const VARIABLE_INK = 'ink';
const VARIABLE_MUTED = 'muted';
const VARIABLE_ACCENT = 'accent';
const VARIABLE_INFO = 'info';
const VARIABLE_WARNING = 'warning';
const VARIABLE_SUCCESS = 'success';
const VARIABLE_SURFACE = 'surface';
const VARIABLE_SURFACE_RAISED = 'surface.raised';
const VARIABLE_SURFACE_MUTED = 'surface.muted';
const ACTIVE_EDGE_CHAR = '░';
const THEME_MODE_LABEL_DARK = 'Dark';
const THEME_MODE_LABEL_LIGHT = 'Light';
const COLOR_CHANNEL_MAX = 255;

type RgbTuple = readonly [number, number, number];

interface ThemePalette {
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

interface ThemeVariables {
  readonly ink: ThemeColorVariable;
  readonly muted: ThemeColorVariable;
  readonly accent: ThemeColorVariable;
  readonly info: ThemeColorVariable;
  readonly warning: ThemeColorVariable;
  readonly success: ThemeColorVariable;
  readonly surface: ThemeColorVariable;
  readonly surfaceRaised: ThemeColorVariable;
  readonly surfaceMuted: ThemeColorVariable;
}

interface PaletteThemeOptions {
  readonly mode: JeditThemeMode;
  readonly familyName?: string;
  readonly variantSource?: JeditThemeVariantSource;
  readonly companionThemeName?: string;
}

const GRAPHITE_PALETTE = {
  ink: [226, 231, 236],
  muted: [126, 137, 148],
  accent: [216, 151, 255],
  info: [101, 194, 255],
  warning: [245, 184, 92],
  success: [124, 213, 156],
  surface: [14, 17, 22],
  surfaceRaised: [28, 32, 40],
  surfaceMuted: [22, 26, 33],
} satisfies ThemePalette;

const MORNING_PALETTE = {
  ink: [34, 39, 46],
  muted: [112, 118, 126],
  accent: [170, 79, 31],
  info: [37, 118, 145],
  warning: [146, 95, 23],
  success: [53, 124, 84],
  surface: [244, 241, 232],
  surfaceRaised: [232, 228, 217],
  surfaceMuted: [222, 218, 208],
} satisfies ThemePalette;

const MONOKAI_PALETTE = {
  ink: [248, 248, 242],
  muted: [117, 113, 94],
  accent: [249, 38, 114],
  info: [102, 217, 239],
  warning: [253, 151, 31],
  success: [166, 226, 46],
  surface: [39, 40, 34],
  surfaceRaised: [49, 50, 43],
  surfaceMuted: [58, 59, 50],
} satisfies ThemePalette;

const SOLARIZED_DARK_PALETTE = {
  ink: [238, 232, 213],
  muted: [131, 148, 150],
  accent: [211, 54, 130],
  info: [38, 139, 210],
  warning: [181, 137, 0],
  success: [133, 153, 0],
  surface: [0, 43, 54],
  surfaceRaised: [7, 54, 66],
  surfaceMuted: [1, 36, 45],
} satisfies ThemePalette;

const SOLARIZED_LIGHT_PALETTE = {
  ink: [101, 123, 131],
  muted: [147, 161, 161],
  accent: [211, 54, 130],
  info: [38, 139, 210],
  warning: [181, 137, 0],
  success: [133, 153, 0],
  surface: [253, 246, 227],
  surfaceRaised: [238, 232, 213],
  surfaceMuted: [238, 232, 213],
} satisfies ThemePalette;

const DRACULA_PALETTE = {
  ink: [248, 248, 242],
  muted: [98, 114, 164],
  accent: [189, 147, 249],
  info: [139, 233, 253],
  warning: [255, 184, 108],
  success: [80, 250, 123],
  surface: [40, 42, 54],
  surfaceRaised: [68, 71, 90],
  surfaceMuted: [50, 52, 67],
} satisfies ThemePalette;

const NORD_PALETTE = {
  ink: [216, 222, 233],
  muted: [136, 151, 168],
  accent: [180, 142, 173],
  info: [136, 192, 208],
  warning: [235, 203, 139],
  success: [163, 190, 140],
  surface: [46, 52, 64],
  surfaceRaised: [59, 66, 82],
  surfaceMuted: [67, 76, 94],
} satisfies ThemePalette;

const CATPPUCCIN_PALETTE = {
  ink: [205, 214, 244],
  muted: [147, 153, 178],
  accent: [203, 166, 247],
  info: [137, 180, 250],
  warning: [249, 226, 175],
  success: [166, 227, 161],
  surface: [30, 30, 46],
  surfaceRaised: [49, 50, 68],
  surfaceMuted: [69, 71, 90],
} satisfies ThemePalette;

const GRAPHITE_THEME = definePaletteTheme(GRAPHITE_THEME_NAME, GRAPHITE_PALETTE, { mode: JEDIT_THEME_MODE.Dark });
const MORNING_THEME = definePaletteTheme(MORNING_THEME_NAME, MORNING_PALETTE, { mode: JEDIT_THEME_MODE.Light });
const MONOKAI_THEME = definePaletteTheme(MONOKAI_THEME_NAME, MONOKAI_PALETTE, { mode: JEDIT_THEME_MODE.Dark });
const SOLARIZED_DARK_THEME = definePaletteTheme(SOLARIZED_DARK_THEME_NAME, SOLARIZED_DARK_PALETTE, {
  mode: JEDIT_THEME_MODE.Dark,
  familyName: SOLARIZED_FAMILY_NAME,
  companionThemeName: SOLARIZED_LIGHT_THEME_NAME,
});
const SOLARIZED_LIGHT_THEME = definePaletteTheme(SOLARIZED_LIGHT_THEME_NAME, SOLARIZED_LIGHT_PALETTE, {
  mode: JEDIT_THEME_MODE.Light,
  familyName: SOLARIZED_FAMILY_NAME,
  companionThemeName: SOLARIZED_DARK_THEME_NAME,
});
const DRACULA_THEME = definePaletteTheme(DRACULA_THEME_NAME, DRACULA_PALETTE, { mode: JEDIT_THEME_MODE.Dark });
const NORD_THEME = definePaletteTheme(NORD_THEME_NAME, NORD_PALETTE, { mode: JEDIT_THEME_MODE.Dark });
const CATPPUCCIN_THEME = definePaletteTheme(CATPPUCCIN_THEME_NAME, CATPPUCCIN_PALETTE, { mode: JEDIT_THEME_MODE.Dark });

const BUILT_IN_THEMES: readonly JeditTheme[] = [
  GRAPHITE_THEME,
  MORNING_THEME,
  MONOKAI_THEME,
  SOLARIZED_DARK_THEME,
  SOLARIZED_LIGHT_THEME,
  DRACULA_THEME,
  NORD_THEME,
  CATPPUCCIN_THEME,
];
const DEFAULT_THEME = GRAPHITE_THEME;
const GENERATED_COMPANION_CACHE = new Map<string, JeditTheme>();

export function availableJeditThemes(): readonly JeditTheme[] {
  return [...BUILT_IN_THEMES];
}

export function resolveInitialJeditTheme(themeName: string | undefined): JeditTheme {
  const match = BUILT_IN_THEMES.find((theme) => theme.name === themeName);
  return match ?? DEFAULT_THEME;
}

export function nextJeditTheme(current: JeditTheme): JeditTheme {
  const currentName = current.variantSource === JEDIT_THEME_VARIANT_SOURCE.Generated
    ? current.companionThemeName
    : current.name;
  const currentIndex = BUILT_IN_THEMES.findIndex((theme) => theme.name === currentName);
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % BUILT_IN_THEMES.length;
  return BUILT_IN_THEMES[nextIndex] ?? DEFAULT_THEME;
}

export function oppositeJeditTheme(theme: JeditTheme): JeditTheme {
  const authoredCompanion = theme.companionThemeName == null ? undefined : themeByName(theme.companionThemeName);
  if (authoredCompanion != null) {
    return authoredCompanion;
  }

  const targetMode = oppositeThemeMode(theme.mode);
  const cacheKey = `${theme.name}:${targetMode}`;
  const cached = GENERATED_COMPANION_CACHE.get(cacheKey);
  if (cached != null) {
    return cached;
  }

  const generated = definePaletteTheme(
    `${theme.familyName}-${targetMode}`,
    oppositePalette(paletteFromTheme(theme)),
    {
      mode: targetMode,
      familyName: theme.familyName,
      variantSource: JEDIT_THEME_VARIANT_SOURCE.Generated,
      companionThemeName: theme.name,
    },
  );
  GENERATED_COMPANION_CACHE.set(cacheKey, generated);
  return generated;
}

export function jeditThemeModeLabel(theme: JeditTheme): string {
  return theme.mode === JEDIT_THEME_MODE.Light ? THEME_MODE_LABEL_LIGHT : THEME_MODE_LABEL_DARK;
}

function definePaletteTheme(name: string, palette: ThemePalette, options: PaletteThemeOptions): JeditTheme {
  return defineJeditTheme(name, (draft) => {
    applyThemeTokens(draft, paletteVariables(draft, palette));
  }, {
    mode: options.mode,
    familyName: options.familyName,
    variantSource: options.variantSource,
    companionThemeName: options.companionThemeName,
  });
}

function paletteVariables(draft: JeditThemeDraft, palette: ThemePalette): ThemeVariables {
  return {
    ink: variableFromRgb(draft, VARIABLE_INK, palette.ink),
    muted: variableFromRgb(draft, VARIABLE_MUTED, palette.muted),
    accent: variableFromRgb(draft, VARIABLE_ACCENT, palette.accent),
    info: variableFromRgb(draft, VARIABLE_INFO, palette.info),
    warning: variableFromRgb(draft, VARIABLE_WARNING, palette.warning),
    success: variableFromRgb(draft, VARIABLE_SUCCESS, palette.success),
    surface: variableFromRgb(draft, VARIABLE_SURFACE, palette.surface),
    surfaceRaised: variableFromRgb(draft, VARIABLE_SURFACE_RAISED, palette.surfaceRaised),
    surfaceMuted: variableFromRgb(draft, VARIABLE_SURFACE_MUTED, palette.surfaceMuted),
  };
}

function variableFromRgb(draft: JeditThemeDraft, name: string, color: RgbTuple): ThemeColorVariable {
  return draft.variable(name, draft.rgb(color[0], color[1], color[2]));
}

function themeByName(themeName: string): JeditTheme | undefined {
  return BUILT_IN_THEMES.find((theme) => theme.name === themeName);
}

function oppositeThemeMode(mode: JeditThemeMode): JeditThemeMode {
  return mode === JEDIT_THEME_MODE.Dark ? JEDIT_THEME_MODE.Light : JEDIT_THEME_MODE.Dark;
}

function oppositePalette(palette: ThemePalette): ThemePalette {
  return {
    ink: invertColor(palette.ink),
    muted: invertColor(palette.muted),
    accent: invertColor(palette.accent),
    info: invertColor(palette.info),
    warning: invertColor(palette.warning),
    success: invertColor(palette.success),
    surface: invertColor(palette.surface),
    surfaceRaised: invertColor(palette.surfaceRaised),
    surfaceMuted: invertColor(palette.surfaceMuted),
  };
}

function paletteFromTheme(theme: JeditTheme): ThemePalette {
  return {
    ink: variableRgb(theme, VARIABLE_INK, [226, 231, 236]),
    muted: variableRgb(theme, VARIABLE_MUTED, [126, 137, 148]),
    accent: variableRgb(theme, VARIABLE_ACCENT, [216, 151, 255]),
    info: variableRgb(theme, VARIABLE_INFO, [101, 194, 255]),
    warning: variableRgb(theme, VARIABLE_WARNING, [245, 184, 92]),
    success: variableRgb(theme, VARIABLE_SUCCESS, [124, 213, 156]),
    surface: variableRgb(theme, VARIABLE_SURFACE, [14, 17, 22]),
    surfaceRaised: variableRgb(theme, VARIABLE_SURFACE_RAISED, [28, 32, 40]),
    surfaceMuted: variableRgb(theme, VARIABLE_SURFACE_MUTED, [22, 26, 33]),
  };
}

function variableRgb(theme: JeditTheme, name: string, fallback: RgbTuple): RgbTuple {
  return theme.variables.get(name)?.rgb ?? fallback;
}

function invertColor(color: RgbTuple): RgbTuple {
  return [
    COLOR_CHANNEL_MAX - color[0],
    COLOR_CHANNEL_MAX - color[1],
    COLOR_CHANNEL_MAX - color[2],
  ];
}

function applyThemeTokens(draft: JeditThemeDraft, variables: ThemeVariables): void {
  draft.surface.workspace.foregroundColor = variables.ink;
  draft.surface.workspace.backgroundColor = variables.surface;
  draft.surface.drawer.foregroundColor = variables.ink;
  draft.surface.drawer.backgroundColor = variables.surfaceMuted;
  draft.surface.footer.foregroundColor = variables.ink;
  draft.surface.footer.backgroundColor = variables.surfaceMuted;

  draft.cursor.normal.foregroundColor = variables.ink;
  draft.cursor.normal.backgroundColor = variables.accent;
  draft.cursor.normal.modifiers = [JEDIT_TEXT_MODIFIER.Inverse];
  draft.cursor.normal.spring = draft.spring({ mass: 1, stiffness: 180, damping: 24 });
  draft.cursor.insert.foregroundColor = variables.info;
  draft.cursor.insert.modifiers = [JEDIT_TEXT_MODIFIER.Underline];

  draft.chrome.activeEdge.char = ACTIVE_EDGE_CHAR;
  draft.chrome.activeEdge.foregroundColor = variables.accent;
  draft.chrome.titleLogo.foregroundColor = variables.accent.to(variables.info).easeInOut(6);
  draft.chrome.titleLogo.backgroundColor = variables.surface;
  draft.chrome.titleLogo.modifiers = [JEDIT_TEXT_MODIFIER.Bold];
  draft.chrome.titleLogo.gradient = draft.gradient(variables.accent, variables.info);
  draft.chrome.titleLogoShadow.foregroundColor = variables.muted;
  draft.chrome.titleLogoShadow.backgroundColor = variables.surface;
  draft.chrome.titleLogoShadow.modifiers = [JEDIT_TEXT_MODIFIER.Dim];
  draft.chrome.titleSceneNear.foregroundColor = variables.ink;
  draft.chrome.titleSceneNear.backgroundColor = variables.surface;
  draft.chrome.titleSceneFar.foregroundColor = variables.muted;
  draft.chrome.titleSceneFar.backgroundColor = variables.surface;

  draft.source.comment.foregroundColor = variables.muted;
  draft.source.comment.modifiers = [JEDIT_TEXT_MODIFIER.Dim, JEDIT_TEXT_MODIFIER.Italic];
  draft.source.function.foregroundColor = variables.accent;
  draft.source.keyword.foregroundColor = variables.accent.to(variables.info).easeIn(0.2);
  draft.source.keyword.modifiers = [JEDIT_TEXT_MODIFIER.Bold];
  draft.source.keyword.gradient = draft.gradient(variables.accent, variables.info);
  draft.source.keyword.spring = draft.spring({ mass: 1, stiffness: 160, damping: 20 });
  draft.source.number.foregroundColor = variables.info;
  draft.source.operator.foregroundColor = variables.warning;
  draft.source.property.foregroundColor = variables.ink;
  draft.source.punctuation.foregroundColor = variables.warning;
  draft.source.string.foregroundColor = variables.success;
  draft.source.type.foregroundColor = variables.accent;
  draft.source.variable.foregroundColor = variables.ink;

  draft.markdown.body.foregroundColor = variables.ink;
  draft.markdown.headingStrong.foregroundColor = variables.accent;
  draft.markdown.headingStrong.modifiers = [JEDIT_TEXT_MODIFIER.Bold];
  draft.markdown.headingStrong.gradient = draft.gradient(variables.accent, variables.info);
  draft.markdown.heading.foregroundColor = variables.info;
  draft.markdown.heading.modifiers = [JEDIT_TEXT_MODIFIER.Bold];
  draft.markdown.headingSoft.foregroundColor = variables.warning;
  draft.markdown.headingSoft.modifiers = [JEDIT_TEXT_MODIFIER.Bold];
  draft.markdown.listMarker.foregroundColor = variables.accent;
  draft.markdown.quoteMarker.foregroundColor = variables.muted;
  draft.markdown.quoteText.foregroundColor = variables.info;
  draft.markdown.code.foregroundColor = variables.ink;
  draft.markdown.code.backgroundColor = variables.surfaceRaised;
  draft.markdown.inlineCode.foregroundColor = variables.warning;
  draft.markdown.inlineCode.backgroundColor = variables.surfaceRaised;
  draft.markdown.rule.foregroundColor = variables.muted;
}
