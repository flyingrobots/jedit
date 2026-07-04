export const SOURCE_LINE_NUMBER_MODE = Object.freeze({
  Absolute: "absolute",
  Relative: "relative",
} as const);

export type SourceLineNumberMode =
  (typeof SOURCE_LINE_NUMBER_MODE)[keyof typeof SOURCE_LINE_NUMBER_MODE];

export function nextSourceLineNumberMode(
  mode: SourceLineNumberMode,
): SourceLineNumberMode {
  return mode === SOURCE_LINE_NUMBER_MODE.Absolute
    ? SOURCE_LINE_NUMBER_MODE.Relative
    : SOURCE_LINE_NUMBER_MODE.Absolute;
}
