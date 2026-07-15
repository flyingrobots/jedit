import { isGraphBackedRopeTextAuthority, type HotTextRuntimePort } from '../ports/hot-text-runtime.js';
import { isFullSnapshotHotTextRuntimeFixture } from './full-snapshot-hot-text-runtime-fixture.js';

export {
  createGraphRopeHotTextAuthority,
  GraphRopeTextAuthorityObstructionError,
} from './graph-rope-hot-text-authority-adapter.js';

export const JEDIT_ALLOW_FULL_SNAPSHOT_TEXT_AUTHORITY = 'JEDIT_ALLOW_FULL_SNAPSHOT_TEXT_AUTHORITY';

const FULL_SNAPSHOT_TEXT_AUTHORITY_GUARD_MESSAGE = 'FullSnapshotHotTextRuntimeFixture cannot be used as production text authority.';
const MISSING_GRAPH_ROPE_TEXT_AUTHORITY_GUARD_MESSAGE = 'Installed jedit contract transport requires graph rope text authority.';

export interface InstalledTextAuthorityGuardOptions {
  readonly allowFullSnapshotTextAuthority?: true;
}

export class FullSnapshotTextAuthorityGuardError extends Error {
  public constructor() {
    super(FULL_SNAPSHOT_TEXT_AUTHORITY_GUARD_MESSAGE);
    this.name = 'FullSnapshotTextAuthorityGuardError';
  }
}

export class MissingGraphRopeTextAuthorityError extends Error {
  public constructor() {
    super(MISSING_GRAPH_ROPE_TEXT_AUTHORITY_GUARD_MESSAGE);
    this.name = 'MissingGraphRopeTextAuthorityError';
  }
}

export function assertInstalledTextAuthorityAllowed(
  runtime: HotTextRuntimePort,
  options: InstalledTextAuthorityGuardOptions,
): void {
  if (isGraphBackedRopeTextAuthority(runtime)) {
    return;
  }
  if (isFullSnapshotAuthorityAllowed(options)) {
    if (!isFullSnapshotHotTextRuntimeFixture(runtime)) {
      throw new MissingGraphRopeTextAuthorityError();
    }
    return;
  }
  if (isFullSnapshotHotTextRuntimeFixture(runtime)) {
    throw new FullSnapshotTextAuthorityGuardError();
  }
  throw new MissingGraphRopeTextAuthorityError();
}

function isFullSnapshotAuthorityAllowed(
  options: InstalledTextAuthorityGuardOptions,
): boolean {
  return options.allowFullSnapshotTextAuthority === true
    || process.env[JEDIT_ALLOW_FULL_SNAPSHOT_TEXT_AUTHORITY] === '1';
}
