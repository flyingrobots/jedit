import {
  JEDIT_COLOR_EFFECT,
  type JeditColorStop,
  type JeditStyleToken,
  type JeditTheme,
} from "./jedit-theme.js";

export const JEDIT_THEME_VARIABLE_TOKEN = Object.freeze({
  Info: "info",
  Warning: "warning",
} as const);

export type JeditThemeVariableToken =
  (typeof JEDIT_THEME_VARIABLE_TOKEN)[keyof typeof JEDIT_THEME_VARIABLE_TOKEN];

export function foregroundTokenFromThemeVariable(
  theme: JeditTheme,
  variableName: JeditThemeVariableToken,
  fallback: JeditStyleToken,
): JeditStyleToken {
  const variable = theme.variables.get(variableName);
  return variable == null
    ? fallback
    : foregroundTokenFromColor(variable, fallback);
}

function foregroundTokenFromColor(
  color: JeditColorStop,
  fallback: JeditStyleToken,
): JeditStyleToken {
  return {
    ...fallback,
    fg: color.hex,
    fgRGB: color.rgb,
    foregroundEffect: {
      kind: JEDIT_COLOR_EFFECT.Solid,
      from: color,
    },
    foregroundVariables: color.variableName == null ? [] : [color.variableName],
  };
}
