export const FILEPATH_STYLE = Object.freeze({ GitRoot: 'git-root', Absolute: 'absolute' } as const);
export type FilepathStyle = typeof FILEPATH_STYLE[keyof typeof FILEPATH_STYLE];
export function nextFilepathStyle(style?: FilepathStyle): FilepathStyle {
  return style === FILEPATH_STYLE.Absolute ? FILEPATH_STYLE.GitRoot : FILEPATH_STYLE.Absolute;
}
