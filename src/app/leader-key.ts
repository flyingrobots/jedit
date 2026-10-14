const PRINTABLE_KEY_LENGTH = 1;
const NON_PRINTING_KEY = /[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/u;

export const LEADER_INPUT_KEYS = Object.freeze({
  Space: 'space',
  LiteralSpace: ' ',
  Escape: 'escape',
} as const);

export class LeaderKey {
  private constructor(readonly value: string) {}

  static from(value: string): LeaderKey | undefined {
    return Array.from(value).length === PRINTABLE_KEY_LENGTH && !NON_PRINTING_KEY.test(value)
      ? new LeaderKey(value)
      : undefined;
  }

  static readonly Default = new LeaderKey('\\');
}
