export const INTERACTIVE_TEXT_RUNTIME_LOCAL = 'local';
export const INTERACTIVE_TEXT_RUNTIME_ECHO = 'echo';

export type InteractiveTextRuntimeMode =
  | typeof INTERACTIVE_TEXT_RUNTIME_LOCAL
  | typeof INTERACTIVE_TEXT_RUNTIME_ECHO;

export function parseInteractiveTextRuntimeMode(
  value: string | undefined,
): InteractiveTextRuntimeMode {
  return value === INTERACTIVE_TEXT_RUNTIME_ECHO
    ? INTERACTIVE_TEXT_RUNTIME_ECHO
    : INTERACTIVE_TEXT_RUNTIME_LOCAL;
}
