import type { JeditTheme } from './jedit-theme.js';
import { JEDIT_TEXT_MODIFIER } from './jedit-theme.js';
import { defineJeditTheme, type JeditThemeDraft, type ThemeColorVariable } from './theme-builder.js';

export const JEDIT_THEME_ENV = 'JEDIT_THEME';

const GRAPHITE_THEME_NAME = 'graphite';
const MORNING_THEME_NAME = 'morning';

const VARIABLE_INK = 'ink';
const VARIABLE_MUTED = 'muted';
const VARIABLE_ACCENT = 'accent';
const VARIABLE_INFO = 'info';
const VARIABLE_WARNING = 'warning';
const VARIABLE_SUCCESS = 'success';
const VARIABLE_SURFACE = 'surface';
const VARIABLE_SURFACE_RAISED = 'surface.raised';
const VARIABLE_SURFACE_MUTED = 'surface.muted';

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

const GRAPHITE_THEME = defineJeditTheme(GRAPHITE_THEME_NAME, (draft) => {
  const variables: ThemeVariables = {
    ink: draft.variable(VARIABLE_INK, draft.rgb(226, 231, 236)),
    muted: draft.variable(VARIABLE_MUTED, draft.rgb(126, 137, 148)),
    accent: draft.variable(VARIABLE_ACCENT, draft.rgb(216, 151, 255)),
    info: draft.variable(VARIABLE_INFO, draft.rgb(101, 194, 255)),
    warning: draft.variable(VARIABLE_WARNING, draft.rgb(245, 184, 92)),
    success: draft.variable(VARIABLE_SUCCESS, draft.rgb(124, 213, 156)),
    surface: draft.variable(VARIABLE_SURFACE, draft.rgb(14, 17, 22)),
    surfaceRaised: draft.variable(VARIABLE_SURFACE_RAISED, draft.rgb(28, 32, 40)),
    surfaceMuted: draft.variable(VARIABLE_SURFACE_MUTED, draft.rgb(22, 26, 33)),
  };
  applyThemeTokens(draft, variables);
});

const MORNING_THEME = defineJeditTheme(MORNING_THEME_NAME, (draft) => {
  const variables: ThemeVariables = {
    ink: draft.variable(VARIABLE_INK, draft.rgb(34, 39, 46)),
    muted: draft.variable(VARIABLE_MUTED, draft.rgb(112, 118, 126)),
    accent: draft.variable(VARIABLE_ACCENT, draft.rgb(170, 79, 31)),
    info: draft.variable(VARIABLE_INFO, draft.rgb(37, 118, 145)),
    warning: draft.variable(VARIABLE_WARNING, draft.rgb(146, 95, 23)),
    success: draft.variable(VARIABLE_SUCCESS, draft.rgb(53, 124, 84)),
    surface: draft.variable(VARIABLE_SURFACE, draft.rgb(244, 241, 232)),
    surfaceRaised: draft.variable(VARIABLE_SURFACE_RAISED, draft.rgb(232, 228, 217)),
    surfaceMuted: draft.variable(VARIABLE_SURFACE_MUTED, draft.rgb(222, 218, 208)),
  };
  applyThemeTokens(draft, variables);
});

const BUILT_IN_THEMES: readonly JeditTheme[] = [
  GRAPHITE_THEME,
  MORNING_THEME,
];
const DEFAULT_THEME = GRAPHITE_THEME;

export function availableJeditThemes(): readonly JeditTheme[] {
  return BUILT_IN_THEMES;
}

export function resolveInitialJeditTheme(themeName: string | undefined): JeditTheme {
  const match = BUILT_IN_THEMES.find((theme) => theme.name === themeName);
  return match ?? DEFAULT_THEME;
}

export function nextJeditTheme(current: JeditTheme): JeditTheme {
  const currentIndex = BUILT_IN_THEMES.findIndex((theme) => theme.name === current.name);
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % BUILT_IN_THEMES.length;
  return BUILT_IN_THEMES[nextIndex] ?? DEFAULT_THEME;
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
