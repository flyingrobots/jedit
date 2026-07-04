import type { JeditTheme, JeditThemeMode } from "./jedit-theme.js";
import {
  JEDIT_THEME_MODE,
  JEDIT_THEME_VARIANT_SOURCE,
  JEDIT_TEXT_MODIFIER,
} from "./jedit-theme.js";
import {
  defineJeditTheme,
  type JeditThemeDraft,
  type ThemeColorVariable,
} from "./theme-builder.js";
import {
  BUILT_IN_PALETTE_THEME_DEFINITIONS,
  DEFAULT_PALETTE_THEME_DEFINITION,
  type BuiltInPaletteThemeDefinition,
  type PaletteThemeOptions,
  type RgbTuple,
  type ThemePalette,
  type TitleSceneLightingPalette,
} from "./jedit-theme-palettes.js";
import { TITLE_SCENE_LIGHTING_VARIABLE } from "./title-scene-lighting-tokens.js";

export const JEDIT_THEME_ENV = "JEDIT_THEME";

const VARIABLE_INK = "ink";
const VARIABLE_MUTED = "muted";
const VARIABLE_ACCENT = "accent";
const VARIABLE_INFO = "info";
const VARIABLE_WARNING = "warning";
const VARIABLE_SUCCESS = "success";
const VARIABLE_SURFACE = "surface";
const VARIABLE_SURFACE_RAISED = "surface.raised";
const VARIABLE_SURFACE_MUTED = "surface.muted";
const ACTIVE_EDGE_CHAR = "░";
const THEME_MODE_LABEL_DARK = "Dark";
const THEME_MODE_LABEL_LIGHT = "Light";
const COLOR_CHANNEL_MAX = 255;
const COLOR_CHANNEL_MIN = 0;
const CONTRAST_BLEND_STEPS = 20;
const CONTRAST_LUMINANCE_OFFSET = 0.05;
const CONTRAST_TARGET_LIGHTNESS = 0.5;
const LUMINANCE_BLUE_WEIGHT = 0.0722;
const LUMINANCE_GREEN_WEIGHT = 0.7152;
const LUMINANCE_RED_WEIGHT = 0.2126;
const MIN_ACCENT_CONTRAST_RATIO = 3;
const MIN_SURFACE_TEXT_CONTRAST_RATIO = 4.5;
const SRGB_LINEAR_BREAKPOINT = 0.03928;
const SRGB_LINEAR_DIVISOR = 12.92;
const SRGB_LINEAR_EXPONENT = 2.4;
const SRGB_LINEAR_OFFSET = 0.055;
const SRGB_LINEAR_SCALE = 1.055;

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

const BUILT_IN_THEMES: readonly JeditTheme[] =
  BUILT_IN_PALETTE_THEME_DEFINITIONS.map(themeFromDefinition);
const DEFAULT_THEME =
  themeByName(DEFAULT_PALETTE_THEME_DEFINITION.name) ??
  themeFromDefinition(DEFAULT_PALETTE_THEME_DEFINITION);
const GENERATED_COMPANION_CACHE = new Map<string, JeditTheme>();

export function availableJeditThemes(): readonly JeditTheme[] {
  return [...BUILT_IN_THEMES];
}

export function resolveInitialJeditTheme(
  themeName: string | undefined,
): JeditTheme {
  const match = BUILT_IN_THEMES.find((theme) => theme.name === themeName);
  return match ?? DEFAULT_THEME;
}

export function nextJeditTheme(current: JeditTheme): JeditTheme {
  const currentName =
    current.variantSource === JEDIT_THEME_VARIANT_SOURCE.Generated
      ? current.companionThemeName
      : current.name;
  const currentIndex = BUILT_IN_THEMES.findIndex(
    (theme) => theme.name === currentName,
  );
  const nextIndex =
    currentIndex < 0 ? 0 : (currentIndex + 1) % BUILT_IN_THEMES.length;
  return BUILT_IN_THEMES[nextIndex] ?? DEFAULT_THEME;
}

export function oppositeJeditTheme(theme: JeditTheme): JeditTheme {
  const authoredCompanion =
    theme.companionThemeName == null
      ? undefined
      : themeByName(theme.companionThemeName);
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
  return theme.mode === JEDIT_THEME_MODE.Light
    ? THEME_MODE_LABEL_LIGHT
    : THEME_MODE_LABEL_DARK;
}

function definePaletteTheme(
  name: string,
  palette: ThemePalette,
  options: PaletteThemeOptions,
): JeditTheme {
  return defineJeditTheme(
    name,
    (draft) => {
      applyTitleSceneLightingVariables(draft, options.titleSceneLighting);
      applyThemeTokens(draft, paletteVariables(draft, palette));
    },
    {
      mode: options.mode,
      familyName: options.familyName,
      variantSource: options.variantSource,
      companionThemeName: options.companionThemeName,
    },
  );
}

function themeFromDefinition(
  definition: BuiltInPaletteThemeDefinition,
): JeditTheme {
  return definePaletteTheme(
    definition.name,
    definition.palette,
    definition.options,
  );
}

function applyTitleSceneLightingVariables(
  draft: JeditThemeDraft,
  lighting: TitleSceneLightingPalette | undefined,
): void {
  if (lighting == null) {
    return;
  }
  defineOptionalThemeVariable(
    draft,
    TITLE_SCENE_LIGHTING_VARIABLE.Spotlight,
    lighting.spotlight,
  );
  defineOptionalThemeVariable(
    draft,
    TITLE_SCENE_LIGHTING_VARIABLE.FloorDark,
    lighting.floorDark,
  );
  defineOptionalThemeVariable(
    draft,
    TITLE_SCENE_LIGHTING_VARIABLE.FloorLight,
    lighting.floorLight,
  );
}

function defineOptionalThemeVariable(
  draft: JeditThemeDraft,
  name: string,
  color: RgbTuple | undefined,
): void {
  if (color != null) {
    variableFromRgb(draft, name, color);
  }
}

function paletteVariables(
  draft: JeditThemeDraft,
  palette: ThemePalette,
): ThemeVariables {
  return {
    ink: variableFromRgb(draft, VARIABLE_INK, palette.ink),
    muted: variableFromRgb(draft, VARIABLE_MUTED, palette.muted),
    accent: variableFromRgb(draft, VARIABLE_ACCENT, palette.accent),
    info: variableFromRgb(draft, VARIABLE_INFO, palette.info),
    warning: variableFromRgb(draft, VARIABLE_WARNING, palette.warning),
    success: variableFromRgb(draft, VARIABLE_SUCCESS, palette.success),
    surface: variableFromRgb(draft, VARIABLE_SURFACE, palette.surface),
    surfaceRaised: variableFromRgb(
      draft,
      VARIABLE_SURFACE_RAISED,
      palette.surfaceRaised,
    ),
    surfaceMuted: variableFromRgb(
      draft,
      VARIABLE_SURFACE_MUTED,
      palette.surfaceMuted,
    ),
  };
}

function variableFromRgb(
  draft: JeditThemeDraft,
  name: string,
  color: RgbTuple,
): ThemeColorVariable {
  return draft.variable(name, draft.rgb(color[0], color[1], color[2]));
}

function themeByName(themeName: string): JeditTheme | undefined {
  return BUILT_IN_THEMES.find((theme) => theme.name === themeName);
}

function oppositeThemeMode(mode: JeditThemeMode): JeditThemeMode {
  return mode === JEDIT_THEME_MODE.Dark
    ? JEDIT_THEME_MODE.Light
    : JEDIT_THEME_MODE.Dark;
}

function oppositePalette(palette: ThemePalette): ThemePalette {
  return contrastAdjustedPalette({
    ink: invertColor(palette.ink),
    muted: invertColor(palette.muted),
    accent: invertColor(palette.accent),
    info: invertColor(palette.info),
    warning: invertColor(palette.warning),
    success: invertColor(palette.success),
    surface: invertColor(palette.surface),
    surfaceRaised: invertColor(palette.surfaceRaised),
    surfaceMuted: invertColor(palette.surfaceMuted),
  });
}

function contrastAdjustedPalette(palette: ThemePalette): ThemePalette {
  return {
    ink: contrastAdjustedColor(palette.ink, surfaceBackgrounds(palette), MIN_SURFACE_TEXT_CONTRAST_RATIO),
    muted: contrastAdjustedColor(palette.muted, [palette.surface], MIN_ACCENT_CONTRAST_RATIO),
    accent: contrastAdjustedColor(palette.accent, [palette.surface], MIN_ACCENT_CONTRAST_RATIO),
    info: contrastAdjustedColor(palette.info, [palette.surface, palette.surfaceRaised], MIN_ACCENT_CONTRAST_RATIO),
    warning: contrastAdjustedColor(palette.warning, [palette.surface, palette.surfaceRaised], MIN_ACCENT_CONTRAST_RATIO),
    success: contrastAdjustedColor(palette.success, [palette.surface], MIN_ACCENT_CONTRAST_RATIO),
    surface: palette.surface,
    surfaceRaised: palette.surfaceRaised,
    surfaceMuted: palette.surfaceMuted,
  };
}

function surfaceBackgrounds(palette: ThemePalette): readonly RgbTuple[] {
  return [palette.surface, palette.surfaceRaised, palette.surfaceMuted];
}

function contrastAdjustedColor(
  color: RgbTuple,
  backgrounds: readonly RgbTuple[],
  minContrastRatio: number,
): RgbTuple {
  const target = averageLuminance(backgrounds) > CONTRAST_TARGET_LIGHTNESS
    ? colorTarget(COLOR_CHANNEL_MIN)
    : colorTarget(COLOR_CHANNEL_MAX);
  for (let step = 0; step <= CONTRAST_BLEND_STEPS; step += 1) {
    const candidate = blendColor(color, target, step / CONTRAST_BLEND_STEPS);
    if (passesContrast(candidate, backgrounds, minContrastRatio)) {
      return candidate;
    }
  }
  return target;
}

function averageLuminance(colors: readonly RgbTuple[]): number {
  const total = colors.reduce((sum, color) => sum + relativeColorLuminance(color), 0);
  return total / colors.length;
}

function colorTarget(channel: number): RgbTuple {
  return [channel, channel, channel];
}

function blendColor(from: RgbTuple, to: RgbTuple, amount: number): RgbTuple {
  return [
    blendChannel(from[0], to[0], amount),
    blendChannel(from[1], to[1], amount),
    blendChannel(from[2], to[2], amount),
  ];
}

function blendChannel(from: number, to: number, amount: number): number {
  return Math.round(from + ((to - from) * amount));
}

function passesContrast(
  color: RgbTuple,
  backgrounds: readonly RgbTuple[],
  minContrastRatio: number,
): boolean {
  return backgrounds.every(
    (background) => colorContrastRatio(color, background) >= minContrastRatio,
  );
}

function colorContrastRatio(first: RgbTuple, second: RgbTuple): number {
  const firstLuminance = relativeColorLuminance(first);
  const secondLuminance = relativeColorLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + CONTRAST_LUMINANCE_OFFSET) / (darker + CONTRAST_LUMINANCE_OFFSET);
}

function relativeColorLuminance(color: RgbTuple): number {
  return (
    linearChannel(color[0]) * LUMINANCE_RED_WEIGHT +
    linearChannel(color[1]) * LUMINANCE_GREEN_WEIGHT +
    linearChannel(color[2]) * LUMINANCE_BLUE_WEIGHT
  );
}

function linearChannel(channel: number): number {
  const scaled = channel / COLOR_CHANNEL_MAX;
  return scaled <= SRGB_LINEAR_BREAKPOINT
    ? scaled / SRGB_LINEAR_DIVISOR
    : ((scaled + SRGB_LINEAR_OFFSET) / SRGB_LINEAR_SCALE) ** SRGB_LINEAR_EXPONENT;
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

function variableRgb(
  theme: JeditTheme,
  name: string,
  fallback: RgbTuple,
): RgbTuple {
  return theme.variables.get(name)?.rgb ?? fallback;
}

function invertColor(color: RgbTuple): RgbTuple {
  return [
    COLOR_CHANNEL_MAX - color[0],
    COLOR_CHANNEL_MAX - color[1],
    COLOR_CHANNEL_MAX - color[2],
  ];
}

function applyThemeTokens(
  draft: JeditThemeDraft,
  variables: ThemeVariables,
): void {
  applySurfaceThemeTokens(draft, variables);
  applyCursorThemeTokens(draft, variables);
  applyChromeThemeTokens(draft, variables);
  applySourceThemeTokens(draft, variables);
  applyMarkdownThemeTokens(draft, variables);
}

function applySurfaceThemeTokens(
  draft: JeditThemeDraft,
  variables: ThemeVariables,
): void {
  draft.surface.workspace.foregroundColor = variables.ink;
  draft.surface.workspace.backgroundColor = variables.surface;
  draft.surface.drawer.foregroundColor = variables.ink;
  draft.surface.drawer.backgroundColor = variables.surfaceMuted;
  draft.surface.footer.foregroundColor = variables.ink;
  draft.surface.footer.backgroundColor = variables.surfaceMuted;
}

function applyCursorThemeTokens(
  draft: JeditThemeDraft,
  variables: ThemeVariables,
): void {
  draft.cursor.normal.foregroundColor = variables.ink;
  draft.cursor.normal.backgroundColor = variables.accent;
  draft.cursor.normal.modifiers = [JEDIT_TEXT_MODIFIER.Inverse];
  draft.cursor.normal.spring = draft.spring({
    mass: 1,
    stiffness: 180,
    damping: 24,
  });
  draft.cursor.insert.foregroundColor = variables.info;
  draft.cursor.insert.modifiers = [JEDIT_TEXT_MODIFIER.Underline];
}

function applyChromeThemeTokens(
  draft: JeditThemeDraft,
  variables: ThemeVariables,
): void {
  draft.chrome.activeEdge.char = ACTIVE_EDGE_CHAR;
  draft.chrome.activeEdge.foregroundColor = variables.accent;
  draft.chrome.titleLogo.foregroundColor = variables.accent
    .to(variables.info)
    .easeInOut(6);
  draft.chrome.titleLogo.backgroundColor = variables.surface;
  draft.chrome.titleLogo.modifiers = [JEDIT_TEXT_MODIFIER.Bold];
  draft.chrome.titleLogo.gradient = draft.gradient(
    variables.accent,
    variables.info,
  );
  draft.chrome.titleLogoShadow.foregroundColor = variables.muted;
  draft.chrome.titleLogoShadow.backgroundColor = variables.surface;
  draft.chrome.titleLogoShadow.modifiers = [JEDIT_TEXT_MODIFIER.Dim];
  draft.chrome.titleSceneNear.foregroundColor = variables.ink;
  draft.chrome.titleSceneNear.backgroundColor = variables.surface;
  draft.chrome.titleSceneFar.foregroundColor = variables.muted;
  draft.chrome.titleSceneFar.backgroundColor = variables.surface;
}

function applySourceThemeTokens(
  draft: JeditThemeDraft,
  variables: ThemeVariables,
): void {
  draft.source.comment.foregroundColor = variables.muted;
  draft.source.comment.modifiers = [
    JEDIT_TEXT_MODIFIER.Dim,
    JEDIT_TEXT_MODIFIER.Italic,
  ];
  draft.source.function.foregroundColor = variables.accent;
  draft.source.keyword.foregroundColor = variables.accent
    .to(variables.info)
    .easeIn(0.2);
  draft.source.keyword.modifiers = [JEDIT_TEXT_MODIFIER.Bold];
  draft.source.keyword.gradient = draft.gradient(
    variables.accent,
    variables.info,
  );
  draft.source.keyword.spring = draft.spring({
    mass: 1,
    stiffness: 160,
    damping: 20,
  });
  draft.source.number.foregroundColor = variables.info;
  draft.source.operator.foregroundColor = variables.warning;
  draft.source.property.foregroundColor = variables.ink;
  draft.source.punctuation.foregroundColor = variables.warning;
  draft.source.string.foregroundColor = variables.success;
  draft.source.type.foregroundColor = variables.accent;
  draft.source.variable.foregroundColor = variables.ink;
}

function applyMarkdownThemeTokens(
  draft: JeditThemeDraft,
  variables: ThemeVariables,
): void {
  draft.markdown.body.foregroundColor = variables.ink;
  draft.markdown.headingStrong.foregroundColor = variables.accent;
  draft.markdown.headingStrong.modifiers = [JEDIT_TEXT_MODIFIER.Bold];
  draft.markdown.headingStrong.gradient = draft.gradient(
    variables.accent,
    variables.info,
  );
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
