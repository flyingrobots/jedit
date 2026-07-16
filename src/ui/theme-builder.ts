import {
  JEDIT_COLOR_EFFECT,
  JEDIT_EASING,
  JEDIT_MARKDOWN_TOKEN,
  JEDIT_SOURCE_TOKEN,
  JEDIT_THEME_MODE,
  JEDIT_THEME_VARIANT_SOURCE,
  JEDIT_TEXT_MODIFIER,
  type JeditColorEffect,
  type JeditColorStop,
  type JeditEasing,
  type JeditGradient,
  type JeditGradientStop,
  type JeditMarkdownToken,
  type JeditSourceToken,
  type JeditSpring,
  type JeditStyleToken,
  type JeditTextModifier,
  type JeditTheme,
  type JeditThemeMode,
  type JeditThemeVariantSource,
} from './jedit-theme.js';
import { SOURCE_HIGHLIGHT_ROLE } from '../ports/source-highlighter.js';
import { DuplicateThemeVariableError } from '../domain/errors.js';

const COLOR_CHANNEL_MIN = 0;
const COLOR_CHANNEL_MAX = 255;
const HEX_RADIX = 16;
const HEX_PAIR_WIDTH = 2;
const PERCENT_START = 0;
const PERCENT_END = 1;
const MODE_LUMINANCE_THRESHOLD = 128;
const LUMINANCE_RED_WEIGHT = 0.2126;
const LUMINANCE_GREEN_WEIGHT = 0.7152;
const LUMINANCE_BLUE_WEIGHT = 0.0722;

type ThemeColorPaint = RgbColor | ThemeColorVariable | ThemeColorTransition;

export class RgbColor implements JeditColorStop {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly hex: string;
  readonly rgb: readonly [number, number, number];

  constructor(red: number, green: number, blue: number) {
    this.red = clampChannel(red);
    this.green = clampChannel(green);
    this.blue = clampChannel(blue);
    this.rgb = [this.red, this.green, this.blue];
    this.hex = rgbHex(this.red, this.green, this.blue);
  }

  to(next: RgbColor | ThemeColorVariable): ThemeColorTransitionDraft {
    return new ThemeColorTransitionDraft(this, next);
  }

  toTokenValue(): JeditStyleToken {
    return styleTokenFromDraft({ foregroundColor: this });
  }
}

export class ThemeColorVariable implements JeditColorStop {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly hex: string;
  readonly rgb: readonly [number, number, number];
  readonly variableName: string;

  constructor(variableName: string, color: RgbColor) {
    this.variableName = variableName;
    this.red = color.red;
    this.green = color.green;
    this.blue = color.blue;
    this.rgb = color.rgb;
    this.hex = color.hex;
  }

  to(next: RgbColor | ThemeColorVariable): ThemeColorTransitionDraft {
    return new ThemeColorTransitionDraft(this, next);
  }

  toTokenValue(): JeditStyleToken {
    return styleTokenFromDraft({ foregroundColor: this });
  }
}

export class ThemeColorTransition {
  readonly kind = JEDIT_COLOR_EFFECT.Transition;
  readonly from: JeditColorStop;
  readonly to: JeditColorStop;
  readonly easing: JeditEasing;
  readonly durationSeconds: number;

  constructor(from: JeditColorStop, to: JeditColorStop, easing: JeditEasing, durationSeconds: number) {
    this.from = from;
    this.to = to;
    this.easing = easing;
    this.durationSeconds = durationSeconds;
  }
}

export class ThemeColorTransitionDraft {
  private readonly from: JeditColorStop;
  private readonly toColor: JeditColorStop;

  constructor(from: JeditColorStop, toColor: JeditColorStop) {
    this.from = from;
    this.toColor = toColor;
  }

  linear(durationSeconds: number): ThemeColorTransition {
    return this.transition(JEDIT_EASING.Linear, durationSeconds);
  }

  easeIn(durationSeconds: number): ThemeColorTransition {
    return this.transition(JEDIT_EASING.EaseIn, durationSeconds);
  }

  easeOut(durationSeconds: number): ThemeColorTransition {
    return this.transition(JEDIT_EASING.EaseOut, durationSeconds);
  }

  easeInOut(durationSeconds: number): ThemeColorTransition {
    return this.transition(JEDIT_EASING.EaseInOut, durationSeconds);
  }

  private transition(easing: JeditEasing, durationSeconds: number): ThemeColorTransition {
    return new ThemeColorTransition(this.from, this.toColor, easing, Math.max(0, durationSeconds));
  }
}

export interface JeditStyleDraft {
  char?: string;
  foregroundColor?: ThemeColorPaint;
  backgroundColor?: ThemeColorPaint;
  modifiers?: readonly JeditTextModifier[];
  gradient?: JeditGradient;
  spring?: JeditSpring;
}

export interface JeditSourceStyleDrafts {
  readonly comment: JeditStyleDraft;
  readonly function: JeditStyleDraft;
  readonly keyword: JeditStyleDraft;
  readonly number: JeditStyleDraft;
  readonly operator: JeditStyleDraft;
  readonly property: JeditStyleDraft;
  readonly punctuation: JeditStyleDraft;
  readonly string: JeditStyleDraft;
  readonly type: JeditStyleDraft;
  readonly variable: JeditStyleDraft;
}

export interface JeditMarkdownStyleDrafts {
  readonly body: JeditStyleDraft;
  readonly headingStrong: JeditStyleDraft;
  readonly heading: JeditStyleDraft;
  readonly headingSoft: JeditStyleDraft;
  readonly listMarker: JeditStyleDraft;
  readonly quoteMarker: JeditStyleDraft;
  readonly quoteText: JeditStyleDraft;
  readonly code: JeditStyleDraft;
  readonly inlineCode: JeditStyleDraft;
  readonly rule: JeditStyleDraft;
}

export interface JeditSurfaceStyleDrafts {
  readonly workspace: JeditStyleDraft;
  readonly drawer: JeditStyleDraft;
  readonly footer: JeditStyleDraft;
}

export interface JeditCursorStyleDrafts {
  readonly normal: JeditStyleDraft;
  readonly insert: JeditStyleDraft;
}

export interface JeditChromeStyleDrafts {
  readonly activeEdge: JeditStyleDraft;
  readonly titleLogo: JeditStyleDraft;
  readonly titleLogoShadow: JeditStyleDraft;
  readonly titleSceneNear: JeditStyleDraft;
  readonly titleSceneFar: JeditStyleDraft;
}

export interface JeditGutterStyleDrafts {
  readonly background: JeditStyleDraft;
  readonly lineNumber: JeditStyleDraft;
  readonly currentLineNumber: JeditStyleDraft;
  readonly rule: JeditStyleDraft;
  readonly inserted: JeditStyleDraft;
  readonly modified: JeditStyleDraft;
  readonly deleted: JeditStyleDraft;
  readonly pending: JeditStyleDraft;
  readonly obstructed: JeditStyleDraft;
}

export interface JeditGutterVariantDrafts {
  readonly normal: JeditGutterStyleDrafts;
  readonly dimmed: JeditGutterStyleDrafts;
}

export interface JeditThemeDraft {
  readonly style: typeof JEDIT_TEXT_MODIFIER;
  readonly source: JeditSourceStyleDrafts;
  readonly markdown: JeditMarkdownStyleDrafts;
  readonly surface: JeditSurfaceStyleDrafts;
  readonly cursor: JeditCursorStyleDrafts;
  readonly chrome: JeditChromeStyleDrafts;
  readonly gutter: JeditGutterVariantDrafts;
  rgb(red: number, green: number, blue: number): RgbColor;
  variable(name: string, color: RgbColor): ThemeColorVariable;
  gradient(first: RgbColor | ThemeColorVariable, second: RgbColor | ThemeColorVariable): JeditGradient;
  spring(input: JeditSpring): JeditSpring;
}

export interface JeditThemeDefinitionOptions {
  readonly mode?: JeditThemeMode;
  readonly familyName?: string;
  readonly variantSource?: JeditThemeVariantSource;
  readonly companionThemeName?: string;
}

export function rgb(red: number, green: number, blue: number): RgbColor {
  return new RgbColor(red, green, blue);
}

export function defineJeditTheme(
  name: string,
  build: (draft: JeditThemeDraft) => void,
  options: JeditThemeDefinitionOptions = {},
): JeditTheme {
  const variables = new Map<string, JeditColorStop>();
  const draft = createThemeDraft(variables);
  build(draft);
  const surface = buildSurfaceTokens(draft);

  return {
    name,
    mode: options.mode ?? inferThemeMode(surface.workspace),
    familyName: options.familyName ?? name,
    variantSource: options.variantSource ?? JEDIT_THEME_VARIANT_SOURCE.Authored,
    companionThemeName: options.companionThemeName,
    variables,
    source: buildSourceTokens(draft.source),
    sourceRoleMap: sourceRoleMap(),
    markdown: buildMarkdownTokens(draft.markdown),
    surface,
    cursor: {
      normal: styleTokenFromDraft(draft.cursor.normal),
      insert: styleTokenFromDraft(draft.cursor.insert),
    },
    chrome: {
      activeEdge: styleTokenFromDraft(draft.chrome.activeEdge),
      titleLogo: styleTokenFromDraft(draft.chrome.titleLogo),
      titleLogoShadow: styleTokenFromDraft(draft.chrome.titleLogoShadow),
      titleSceneNear: styleTokenFromDraft(draft.chrome.titleSceneNear),
      titleSceneFar: styleTokenFromDraft(draft.chrome.titleSceneFar),
    },
    gutter: buildGutterVariants(draft),
  };
}

function buildGutterVariants(draft: JeditThemeDraft): JeditTheme['gutter'] {
  return {
    normal: buildGutterTokens(draft.gutter.normal),
    dimmed: buildGutterTokens(draft.gutter.dimmed),
  };
}

function buildSurfaceTokens(draft: JeditThemeDraft): JeditTheme['surface'] {
  return {
    workspace: styleTokenFromDraft(draft.surface.workspace),
    drawer: styleTokenFromDraft(draft.surface.drawer),
    footer: styleTokenFromDraft(draft.surface.footer),
  };
}

function sourceRoleMap(): JeditTheme['sourceRoleMap'] {
  return new Map([
    [SOURCE_HIGHLIGHT_ROLE.Comment, JEDIT_SOURCE_TOKEN.Comment],
    [SOURCE_HIGHLIGHT_ROLE.Function, JEDIT_SOURCE_TOKEN.Function],
    [SOURCE_HIGHLIGHT_ROLE.Keyword, JEDIT_SOURCE_TOKEN.Keyword],
    [SOURCE_HIGHLIGHT_ROLE.Number, JEDIT_SOURCE_TOKEN.Number],
    [SOURCE_HIGHLIGHT_ROLE.Operator, JEDIT_SOURCE_TOKEN.Operator],
    [SOURCE_HIGHLIGHT_ROLE.Property, JEDIT_SOURCE_TOKEN.Property],
    [SOURCE_HIGHLIGHT_ROLE.Punctuation, JEDIT_SOURCE_TOKEN.Punctuation],
    [SOURCE_HIGHLIGHT_ROLE.String, JEDIT_SOURCE_TOKEN.String],
    [SOURCE_HIGHLIGHT_ROLE.Type, JEDIT_SOURCE_TOKEN.Type],
    [SOURCE_HIGHLIGHT_ROLE.Variable, JEDIT_SOURCE_TOKEN.Variable],
  ]);
}

function createThemeDraft(variables: Map<string, JeditColorStop>): JeditThemeDraft {
  return {
    style: JEDIT_TEXT_MODIFIER,
    source: createSourceDrafts(),
    markdown: createMarkdownDrafts(),
    surface: { workspace: {}, drawer: {}, footer: {} },
    cursor: { normal: {}, insert: {} },
    chrome: createChromeDrafts(),
    gutter: createGutterVariantDrafts(),
    rgb,
    variable(name: string, color: RgbColor): ThemeColorVariable {
      if (variables.has(name)) {
        throw new DuplicateThemeVariableError(`Duplicate theme variable name: ${name}`);
      }
      const variable = new ThemeColorVariable(name, color);
      variables.set(name, variable);
      return variable;
    },
    gradient(first: RgbColor | ThemeColorVariable, second: RgbColor | ThemeColorVariable): JeditGradient {
      return {
        stops: [
          gradientStop(first, PERCENT_START),
          gradientStop(second, PERCENT_END),
        ],
      };
    },
    spring(input: JeditSpring): JeditSpring {
      return input;
    },
  };
}

function createChromeDrafts(): JeditChromeStyleDrafts {
  return {
    activeEdge: {},
    titleLogo: {},
    titleLogoShadow: {},
    titleSceneNear: {},
    titleSceneFar: {},
  };
}

function createGutterVariantDrafts(): JeditGutterVariantDrafts {
  return { normal: createGutterDrafts(), dimmed: createGutterDrafts() };
}

function createGutterDrafts(): JeditGutterStyleDrafts {
  return {
    background: {},
    lineNumber: {},
    currentLineNumber: {},
    rule: {},
    inserted: {},
    modified: {},
    deleted: {},
    pending: {},
    obstructed: {},
  };
}

function buildGutterTokens(draft: JeditGutterStyleDrafts): JeditTheme['gutter']['normal'] {
  return {
    background: styleTokenFromDraft(draft.background),
    lineNumber: styleTokenFromDraft(draft.lineNumber),
    currentLineNumber: styleTokenFromDraft(draft.currentLineNumber),
    rule: styleTokenFromDraft(draft.rule),
    inserted: styleTokenFromDraft(draft.inserted),
    modified: styleTokenFromDraft(draft.modified),
    deleted: styleTokenFromDraft(draft.deleted),
    pending: styleTokenFromDraft(draft.pending),
    obstructed: styleTokenFromDraft(draft.obstructed),
  };
}

function createSourceDrafts(): JeditSourceStyleDrafts {
  return {
    comment: {},
    function: {},
    keyword: {},
    number: {},
    operator: {},
    property: {},
    punctuation: {},
    string: {},
    type: {},
    variable: {},
  };
}

function createMarkdownDrafts(): JeditMarkdownStyleDrafts {
  return {
    body: {},
    headingStrong: {},
    heading: {},
    headingSoft: {},
    listMarker: {},
    quoteMarker: {},
    quoteText: {},
    code: {},
    inlineCode: {},
    rule: {},
  };
}

function buildSourceTokens(draft: JeditSourceStyleDrafts): ReadonlyMap<JeditSourceToken, JeditStyleToken> {
  return new Map([
    [JEDIT_SOURCE_TOKEN.Comment, styleTokenFromDraft(draft.comment)],
    [JEDIT_SOURCE_TOKEN.Function, styleTokenFromDraft(draft.function)],
    [JEDIT_SOURCE_TOKEN.Keyword, styleTokenFromDraft(draft.keyword)],
    [JEDIT_SOURCE_TOKEN.Number, styleTokenFromDraft(draft.number)],
    [JEDIT_SOURCE_TOKEN.Operator, styleTokenFromDraft(draft.operator)],
    [JEDIT_SOURCE_TOKEN.Property, styleTokenFromDraft(draft.property)],
    [JEDIT_SOURCE_TOKEN.Punctuation, styleTokenFromDraft(draft.punctuation)],
    [JEDIT_SOURCE_TOKEN.String, styleTokenFromDraft(draft.string)],
    [JEDIT_SOURCE_TOKEN.Type, styleTokenFromDraft(draft.type)],
    [JEDIT_SOURCE_TOKEN.Variable, styleTokenFromDraft(draft.variable)],
  ]);
}

function buildMarkdownTokens(draft: JeditMarkdownStyleDrafts): ReadonlyMap<JeditMarkdownToken, JeditStyleToken> {
  return new Map([
    [JEDIT_MARKDOWN_TOKEN.Body, styleTokenFromDraft(draft.body)],
    [JEDIT_MARKDOWN_TOKEN.HeadingStrong, styleTokenFromDraft(draft.headingStrong)],
    [JEDIT_MARKDOWN_TOKEN.Heading, styleTokenFromDraft(draft.heading)],
    [JEDIT_MARKDOWN_TOKEN.HeadingSoft, styleTokenFromDraft(draft.headingSoft)],
    [JEDIT_MARKDOWN_TOKEN.ListMarker, styleTokenFromDraft(draft.listMarker)],
    [JEDIT_MARKDOWN_TOKEN.QuoteMarker, styleTokenFromDraft(draft.quoteMarker)],
    [JEDIT_MARKDOWN_TOKEN.QuoteText, styleTokenFromDraft(draft.quoteText)],
    [JEDIT_MARKDOWN_TOKEN.Code, styleTokenFromDraft(draft.code)],
    [JEDIT_MARKDOWN_TOKEN.InlineCode, styleTokenFromDraft(draft.inlineCode)],
    [JEDIT_MARKDOWN_TOKEN.Rule, styleTokenFromDraft(draft.rule)],
  ]);
}

function styleTokenFromDraft(draft: JeditStyleDraft): JeditStyleToken {
  const foreground = draft.foregroundColor == null ? undefined : colorEffectFromPaint(draft.foregroundColor);
  const background = draft.backgroundColor == null ? undefined : colorEffectFromPaint(draft.backgroundColor);
  return {
    char: draft.char,
    hex: foreground?.from.hex,
    fg: foreground?.from.hex,
    fgRGB: foreground?.from.rgb,
    bg: background?.from.hex,
    bgRGB: background?.from.rgb,
    modifiers: draft.modifiers,
    foregroundEffect: foreground,
    backgroundEffect: background,
    foregroundVariables: foreground == null ? [] : variablesForEffect(foreground),
    backgroundVariables: background == null ? [] : variablesForEffect(background),
    gradient: draft.gradient,
    spring: draft.spring,
  };
}

function colorEffectFromPaint(paint: ThemeColorPaint): JeditColorEffect {
  if (paint instanceof ThemeColorTransition) {
    return paint;
  }
  return {
    kind: JEDIT_COLOR_EFFECT.Solid,
    from: paint,
  };
}

function variablesForEffect(effect: JeditColorEffect): readonly string[] {
  const names = [effect.from.variableName];
  if ('to' in effect) {
    names.push(effect.to.variableName);
  }
  return names.filter((name): name is string => name != null);
}

function gradientStop(color: RgbColor | ThemeColorVariable, position: number): JeditGradientStop {
  return { color, position };
}

function inferThemeMode(token: JeditStyleToken): JeditThemeMode {
  const color = token.bgRGB ?? token.fgRGB;
  if (color == null) {
    return JEDIT_THEME_MODE.Dark;
  }
  return colorLuminance(color) >= MODE_LUMINANCE_THRESHOLD
    ? JEDIT_THEME_MODE.Light
    : JEDIT_THEME_MODE.Dark;
}

function colorLuminance(color: readonly [number, number, number]): number {
  return (color[0] * LUMINANCE_RED_WEIGHT)
    + (color[1] * LUMINANCE_GREEN_WEIGHT)
    + (color[2] * LUMINANCE_BLUE_WEIGHT);
}

function clampChannel(value: number): number {
  return Math.max(COLOR_CHANNEL_MIN, Math.min(COLOR_CHANNEL_MAX, Math.round(value)));
}

function rgbHex(red: number, green: number, blue: number): string {
  return `#${hexPair(red)}${hexPair(green)}${hexPair(blue)}`;
}

function hexPair(value: number): string {
  return value.toString(HEX_RADIX).padStart(HEX_PAIR_WIDTH, '0');
}
