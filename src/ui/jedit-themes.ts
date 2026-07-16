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
const MIN_GUTTER_CONTRAST_RATIO = 3;
const CONTRAST_LUMINANCE_OFFSET = 0.05;
const SRGB_LINEAR_THRESHOLD = 0.04045;
const SRGB_LINEAR_DIVISOR = 12.92;
const SRGB_OFFSET = 0.055;
const SRGB_SCALE = 1.055;
const SRGB_EXPONENT = 2.4;
const LUMINANCE_RED_WEIGHT = 0.2126;
const LUMINANCE_GREEN_WEIGHT = 0.7152;
const LUMINANCE_BLUE_WEIGHT = 0.0722;
const GUTTER_VARIANT = Object.freeze({
  Normal: "normal",
  Dimmed: "dimmed",
} as const);
type GutterVariant = typeof GUTTER_VARIANT[keyof typeof GUTTER_VARIANT];

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
  applyGutterThemeTokens(draft, variables);
  applySourceThemeTokens(draft, variables);
  applyMarkdownThemeTokens(draft, variables);
}

function applyGutterThemeTokens(
  draft: JeditThemeDraft,
  variables: ThemeVariables,
): void {
  applyGutterVariant(draft.gutter.normal, variables, GUTTER_VARIANT.Normal);
  applyGutterVariant(draft.gutter.dimmed, variables, GUTTER_VARIANT.Dimmed);
}

function applyGutterVariant(
  tokens: JeditThemeDraft['gutter']['normal'],
  variables: ThemeVariables,
  variant: GutterVariant,
): void {
  tokens.background.foregroundColor = readableGutterColor(variables.muted, variables);
  tokens.lineNumber.foregroundColor = readableGutterColor(variables.muted, variables);
  tokens.currentLineNumber.foregroundColor = readableGutterColor(variables.accent, variables);
  tokens.rule.foregroundColor = readableGutterColor(variables.muted, variables);
  tokens.inserted.foregroundColor = readableGutterColor(variables.success, variables);
  tokens.modified.foregroundColor = readableGutterColor(variables.info, variables);
  tokens.deleted.foregroundColor = readableGutterColor(variables.warning, variables);
  for (const token of Object.values(tokens)) {
    token.backgroundColor = variables.surface;
    if (variant === GUTTER_VARIANT.Dimmed) {
      token.modifiers = [JEDIT_TEXT_MODIFIER.Dim];
    }
  }
  tokens.currentLineNumber.modifiers = variant === GUTTER_VARIANT.Dimmed
    ? [JEDIT_TEXT_MODIFIER.Bold, JEDIT_TEXT_MODIFIER.Dim]
    : [JEDIT_TEXT_MODIFIER.Bold];
}

function readableGutterColor(
  preferred: ThemeColorVariable,
  variables: ThemeVariables,
): ThemeColorVariable {
  return contrastRatio(preferred.rgb, variables.surface.rgb) >= MIN_GUTTER_CONTRAST_RATIO
    ? preferred
    : variables.ink;
}

function contrastRatio(foreground: RgbTuple, background: RgbTuple): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + CONTRAST_LUMINANCE_OFFSET) / (darker + CONTRAST_LUMINANCE_OFFSET);
}

function relativeLuminance(color: RgbTuple): number {
  const red = linearizedColorChannel(color[0]);
  const green = linearizedColorChannel(color[1]);
  const blue = linearizedColorChannel(color[2]);
  return red * LUMINANCE_RED_WEIGHT
    + green * LUMINANCE_GREEN_WEIGHT
    + blue * LUMINANCE_BLUE_WEIGHT;
}

function linearizedColorChannel(channel: number): number {
  const normalized = channel / COLOR_CHANNEL_MAX;
  return normalized <= SRGB_LINEAR_THRESHOLD
    ? normalized / SRGB_LINEAR_DIVISOR
    : ((normalized + SRGB_OFFSET) / SRGB_SCALE) ** SRGB_EXPONENT;
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
