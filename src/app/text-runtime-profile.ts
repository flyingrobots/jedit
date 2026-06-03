export const TEXT_RUNTIME_PROFILE_ECHO_HOSTED = 'echoHosted';
export const TEXT_RUNTIME_PROFILE_PARSE_OK = 'ok';
export const TEXT_RUNTIME_PROFILE_PARSE_OBSTRUCTED = 'obstructed';
export const TEXT_RUNTIME_PROFILE_UNSUPPORTED_CODE = 'unsupported-text-runtime-profile';

const EMPTY_TEXT_RUNTIME_PROFILE_VALUE = '';

export type TextRuntimeProfile = typeof TEXT_RUNTIME_PROFILE_ECHO_HOSTED;

export type TextRuntimeProfileParseKind =
  | typeof TEXT_RUNTIME_PROFILE_PARSE_OK
  | typeof TEXT_RUNTIME_PROFILE_PARSE_OBSTRUCTED;

export interface TextRuntimeProfileSelection {
  readonly kind: typeof TEXT_RUNTIME_PROFILE_PARSE_OK;
  readonly profile: TextRuntimeProfile;
}

export interface TextRuntimeProfileObstruction {
  readonly kind: typeof TEXT_RUNTIME_PROFILE_PARSE_OBSTRUCTED;
  readonly code: typeof TEXT_RUNTIME_PROFILE_UNSUPPORTED_CODE;
  readonly suppliedValue: string;
  readonly requiredProfile: TextRuntimeProfile;
}

export type TextRuntimeProfileParseResult =
  | TextRuntimeProfileSelection
  | TextRuntimeProfileObstruction;

export class TextRuntimeProfileError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'TextRuntimeProfileError';
  }
}

export function parseTextRuntimeProfile(
  value: string | undefined,
): TextRuntimeProfileParseResult {
  if (value == null || value === EMPTY_TEXT_RUNTIME_PROFILE_VALUE) {
    return selectedTextRuntimeProfile(TEXT_RUNTIME_PROFILE_ECHO_HOSTED);
  }
  if (value === TEXT_RUNTIME_PROFILE_ECHO_HOSTED) {
    return selectedTextRuntimeProfile(TEXT_RUNTIME_PROFILE_ECHO_HOSTED);
  }
  return {
    kind: TEXT_RUNTIME_PROFILE_PARSE_OBSTRUCTED,
    code: TEXT_RUNTIME_PROFILE_UNSUPPORTED_CODE,
    suppliedValue: value,
    requiredProfile: TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
  };
}

export function selectedTextRuntimeProfile(
  profile: TextRuntimeProfile,
): TextRuntimeProfileSelection {
  return {
    kind: TEXT_RUNTIME_PROFILE_PARSE_OK,
    profile,
  };
}

export function requireTextRuntimeProfile(
  result: TextRuntimeProfileParseResult,
): TextRuntimeProfile {
  if (result.kind === TEXT_RUNTIME_PROFILE_PARSE_OK) {
    return result.profile;
  }
  throw new TextRuntimeProfileError(
    `Unsupported text runtime profile "${result.suppliedValue}". jedit only supports ${result.requiredProfile}.`,
  );
}
