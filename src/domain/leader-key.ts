import { JeditDomainError } from './errors.js';

const PRINTABLE_KEY_LENGTH = 1;
const NON_PRINTING_KEY = /[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/u;
const DEFAULT_LEADER = '\\';
const STRING_TYPE = 'string';
const CONSTRUCTION_TOKEN = Symbol('jedit.leader-key.construction');

/**
 * Thrown when a LeaderKey is constructed outside its validating factory.
 */
export class InvalidLeaderKeyError extends JeditDomainError {}

// A single printable key. Construction is only reachable through `from`, which
// validates the value, and instances are frozen with a private field, so the
// invariant holds in emitted JavaScript as well as in the type system.
export class LeaderKey {
  readonly #value: string;

  private constructor(token: symbol, value: string) {
    if (token !== CONSTRUCTION_TOKEN || !isPrintableKey(value)) {
      throw new InvalidLeaderKeyError('LeaderKey must be created with LeaderKey.from');
    }
    this.#value = value;
    Object.freeze(this);
  }

  get value(): string {
    return this.#value;
  }

  static from(value: string): LeaderKey | undefined {
    return isPrintableKey(value) ? new LeaderKey(CONSTRUCTION_TOKEN, value) : undefined;
  }

  static readonly Default = new LeaderKey(CONSTRUCTION_TOKEN, DEFAULT_LEADER);
}

Object.freeze(LeaderKey);

function isPrintableKey(value: string): boolean {
  return typeof value === STRING_TYPE &&
    Array.from(value).length === PRINTABLE_KEY_LENGTH &&
    !NON_PRINTING_KEY.test(value);
}
