import type { Cell } from '@flyingrobots/bijou';
import type { SourceHighlightRole } from '../ports/source-highlighter.js';

export const JEDIT_TEXT_MODIFIER = {
  Bold: 'bold',
  Dim: 'dim',
  Italic: 'italic',
  Inverse: 'inverse',
  Underline: 'underline',
  CurlyUnderline: 'curly-underline',
  DottedUnderline: 'dotted-underline',
  DashedUnderline: 'dashed-underline',
  Strikethrough: 'strikethrough',
} as const;

export type JeditTextModifier = typeof JEDIT_TEXT_MODIFIER[keyof typeof JEDIT_TEXT_MODIFIER];

export const JEDIT_COLOR_EFFECT = {
  Solid: Symbol('jedit.theme.color-effect.solid'),
  Transition: Symbol('jedit.theme.color-effect.transition'),
} as const;

export type JeditColorEffectKind = typeof JEDIT_COLOR_EFFECT[keyof typeof JEDIT_COLOR_EFFECT];

export const JEDIT_EASING = {
  Linear: Symbol('jedit.theme.easing.linear'),
  EaseIn: Symbol('jedit.theme.easing.ease-in'),
  EaseOut: Symbol('jedit.theme.easing.ease-out'),
  EaseInOut: Symbol('jedit.theme.easing.ease-in-out'),
} as const;

export type JeditEasing = typeof JEDIT_EASING[keyof typeof JEDIT_EASING];

export const JEDIT_THEME_MODE = {
  Dark: 'dark',
  Light: 'light',
} as const;

export type JeditThemeMode = typeof JEDIT_THEME_MODE[keyof typeof JEDIT_THEME_MODE];

export const JEDIT_THEME_VARIANT_SOURCE = {
  Authored: 'authored',
  Generated: 'generated',
} as const;

export type JeditThemeVariantSource = typeof JEDIT_THEME_VARIANT_SOURCE[keyof typeof JEDIT_THEME_VARIANT_SOURCE];

export const JEDIT_SOURCE_TOKEN = {
  Comment: Symbol('jedit.theme.source.comment'),
  Function: Symbol('jedit.theme.source.function'),
  Keyword: Symbol('jedit.theme.source.keyword'),
  Number: Symbol('jedit.theme.source.number'),
  Operator: Symbol('jedit.theme.source.operator'),
  Property: Symbol('jedit.theme.source.property'),
  Punctuation: Symbol('jedit.theme.source.punctuation'),
  String: Symbol('jedit.theme.source.string'),
  Type: Symbol('jedit.theme.source.type'),
  Variable: Symbol('jedit.theme.source.variable'),
} as const;

export type JeditSourceToken = typeof JEDIT_SOURCE_TOKEN[keyof typeof JEDIT_SOURCE_TOKEN];

export const JEDIT_MARKDOWN_TOKEN = {
  Body: Symbol('jedit.theme.markdown.body'),
  HeadingStrong: Symbol('jedit.theme.markdown.heading-strong'),
  Heading: Symbol('jedit.theme.markdown.heading'),
  HeadingSoft: Symbol('jedit.theme.markdown.heading-soft'),
  ListMarker: Symbol('jedit.theme.markdown.list-marker'),
  QuoteMarker: Symbol('jedit.theme.markdown.quote-marker'),
  QuoteText: Symbol('jedit.theme.markdown.quote-text'),
  Code: Symbol('jedit.theme.markdown.code'),
  InlineCode: Symbol('jedit.theme.markdown.inline-code'),
  Rule: Symbol('jedit.theme.markdown.rule'),
} as const;

export type JeditMarkdownToken = typeof JEDIT_MARKDOWN_TOKEN[keyof typeof JEDIT_MARKDOWN_TOKEN];

export interface JeditColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly hex: string;
  readonly rgb: readonly [number, number, number];
}

export interface JeditColorStop extends JeditColor {
  readonly variableName?: string;
}

export interface JeditSolidColorEffect {
  readonly kind: typeof JEDIT_COLOR_EFFECT.Solid;
  readonly from: JeditColorStop;
}

export interface JeditTransitionColorEffect {
  readonly kind: typeof JEDIT_COLOR_EFFECT.Transition;
  readonly from: JeditColorStop;
  readonly to: JeditColorStop;
  readonly easing: JeditEasing;
  readonly durationSeconds: number;
}

export type JeditColorEffect = JeditSolidColorEffect | JeditTransitionColorEffect;

export interface JeditGradientStop {
  readonly color: JeditColorStop;
  readonly position: number;
}

export interface JeditGradient {
  readonly stops: readonly JeditGradientStop[];
}

export interface JeditSpring {
  readonly mass: number;
  readonly stiffness: number;
  readonly damping: number;
}

export interface JeditStyleToken extends Pick<Cell, 'fg' | 'bg' | 'fgRGB' | 'bgRGB'> {
  readonly char?: string;
  readonly hex?: string;
  readonly modifiers?: readonly JeditTextModifier[];
  readonly foregroundEffect?: JeditColorEffect;
  readonly backgroundEffect?: JeditColorEffect;
  readonly foregroundVariables: readonly string[];
  readonly backgroundVariables: readonly string[];
  readonly gradient?: JeditGradient;
  readonly spring?: JeditSpring;
}

export interface JeditThemeSurfaceTokens {
  readonly workspace: JeditStyleToken;
  readonly currentLine: JeditStyleToken;
  readonly drawer: JeditStyleToken;
  readonly header: JeditStyleToken;
  readonly footer: JeditStyleToken;
}

export interface JeditThemeCursorTokens {
  readonly normal: JeditStyleToken;
  readonly insert: JeditStyleToken;
}

export interface JeditThemeChromeTokens {
  readonly activeEdge: JeditStyleToken;
  readonly titleLogo: JeditStyleToken;
  readonly titleLogoShadow: JeditStyleToken;
  readonly titleSceneNear: JeditStyleToken;
  readonly titleSceneFar: JeditStyleToken;
}

export interface JeditThemeGutterTokenSet {
  readonly background: JeditStyleToken;
  readonly lineNumber: JeditStyleToken;
  readonly currentLineNumber: JeditStyleToken;
  readonly rule: JeditStyleToken;
  readonly inserted: JeditStyleToken;
  readonly modified: JeditStyleToken;
  readonly deleted: JeditStyleToken;
  readonly pending: JeditStyleToken;
  readonly obstructed: JeditStyleToken;
}

export interface JeditThemeGutterTokens {
  readonly normal: JeditThemeGutterTokenSet;
  readonly dimmed: JeditThemeGutterTokenSet;
}

export interface JeditTheme {
  readonly name: string;
  readonly mode: JeditThemeMode;
  readonly familyName: string;
  readonly variantSource: JeditThemeVariantSource;
  readonly companionThemeName?: string;
  readonly variables: ReadonlyMap<string, JeditColorStop>;
  readonly source: ReadonlyMap<JeditSourceToken, JeditStyleToken>;
  readonly sourceRoleMap: ReadonlyMap<SourceHighlightRole, JeditSourceToken>;
  readonly markdown: ReadonlyMap<JeditMarkdownToken, JeditStyleToken>;
  readonly surface: JeditThemeSurfaceTokens;
  readonly cursor: JeditThemeCursorTokens;
  readonly chrome: JeditThemeChromeTokens;
  readonly gutter: JeditThemeGutterTokens;
}
