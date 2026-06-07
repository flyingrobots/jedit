const TERMINAL_MOUSE_ALL_MOTION_ENABLE = "\u001b[?1003h";
const TERMINAL_MOUSE_ALL_MOTION_DISABLE = "\u001b[?1003l";

export const JEDIT_TERMINAL_MOUSE_OPTIONS = {
  mouse: true,
  allMotion: true,
} as const;

export function enableJeditTerminalMouseAllMotion(
  write: (sequence: string) => void,
): void {
  write(TERMINAL_MOUSE_ALL_MOTION_ENABLE);
}

export function disableJeditTerminalMouseAllMotion(
  write: (sequence: string) => void,
): void {
  write(TERMINAL_MOUSE_ALL_MOTION_DISABLE);
}
