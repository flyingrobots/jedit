export const TEXT_RUNTIME_PROFILE_ECHO_HOSTED = 'echoHosted';
export const TEXT_RUNTIME_PROFILE_TEST_LOCAL = 'testLocal';
export const TEXT_RUNTIME_PROFILE_PARSE_OK = 'ok';
export const TEXT_RUNTIME_PROFILE_PARSE_OBSTRUCTED = 'obstructed';
export const TEXT_RUNTIME_PROFILE_UNSUPPORTED_CODE = 'unsupported-text-runtime-profile';

const EMPTY_TEXT_RUNTIME_PROFILE_VALUE = '';

export type TextRuntimeProfile =
  | typeof TEXT_RUNTIME_PROFILE_ECHO_HOSTED
  | typeof TEXT_RUNTIME_PROFILE_TEST_LOCAL;

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
  readonly fallbackProfile: TextRuntimeProfile;
}

export type TextRuntimeProfileParseResult =
  | TextRuntimeProfileSelection
  | TextRuntimeProfileObstruction;

export function parseTextRuntimeProfile(
  value: string | undefined,
): TextRuntimeProfileParseResult {
  if (value == null || value === EMPTY_TEXT_RUNTIME_PROFILE_VALUE) {
    return selectedTextRuntimeProfile(TEXT_RUNTIME_PROFILE_ECHO_HOSTED);
  }
  if (value === TEXT_RUNTIME_PROFILE_ECHO_HOSTED) {
    return selectedTextRuntimeProfile(TEXT_RUNTIME_PROFILE_ECHO_HOSTED);
  }
  if (value === TEXT_RUNTIME_PROFILE_TEST_LOCAL) {
    return selectedTextRuntimeProfile(TEXT_RUNTIME_PROFILE_TEST_LOCAL);
  }
  return {
    kind: TEXT_RUNTIME_PROFILE_PARSE_OBSTRUCTED,
    code: TEXT_RUNTIME_PROFILE_UNSUPPORTED_CODE,
    suppliedValue: value,
    fallbackProfile: TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
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

export function resolveTextRuntimeProfile(
  result: TextRuntimeProfileParseResult,
): TextRuntimeProfile {
  return result.kind === TEXT_RUNTIME_PROFILE_PARSE_OK
    ? result.profile
    : result.fallbackProfile;
}
