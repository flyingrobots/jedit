import type { JeditWorldlineSession } from './jedit-contract-runtime.js';
import {
  READ_BASIS_HANDLE_KIND,
  type ReadBasisHandle,
} from '../ports/jedit-optic-client.js';

const READ_BASIS_HANDLE_ID_PREFIX = 'read-basis:';
const FIRST_READ_BASIS_HANDLE_SEQUENCE = 0;
const NEXT_READ_BASIS_HANDLE_STEP = 1;

interface ReadBasisBinding {
  readonly worldlineId: string;
}

export class ReadBasisHandleResolutionError extends Error {
  public constructor() {
    super('ReadBasisHandle does not belong to the supplied jedit session.');
    this.name = 'ReadBasisHandleResolutionError';
  }
}

export class ReadBasisHandleRegistry {
  private nextHandleId = FIRST_READ_BASIS_HANDLE_SEQUENCE;
  private readonly bindings = new Map<string, ReadBasisBinding>();

  public createForSession(session: JeditWorldlineSession): ReadBasisHandle {
    const id = `${READ_BASIS_HANDLE_ID_PREFIX}${this.nextHandleId}`;
    this.nextHandleId += NEXT_READ_BASIS_HANDLE_STEP;
    this.bindings.set(id, {
      worldlineId: session.worldline.worldlineId,
    });
    return Object.freeze({
      kind: READ_BASIS_HANDLE_KIND,
      id,
    });
  }

  public resolveWorldlineId(
    session: JeditWorldlineSession,
    readBasisHandle: ReadBasisHandle,
  ): string {
    const binding = this.bindings.get(readBasisHandle.id);
    if (readBasisHandle.kind !== READ_BASIS_HANDLE_KIND || binding === undefined) {
      throw new ReadBasisHandleResolutionError();
    }
    if (binding.worldlineId !== session.worldline.worldlineId) {
      throw new ReadBasisHandleResolutionError();
    }
    return binding.worldlineId;
  }
}
