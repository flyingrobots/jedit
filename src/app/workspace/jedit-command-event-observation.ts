import type { JeditCommandEvent } from './command-provenance.js';
import {
  workspaceTextAuthorityWithLastCommandEvent,
  type WorkspaceTextAuthority,
  type WorkspaceTextAuthorityOpened,
} from './workspace-text-authority.js';
import { createJeditWhyObservation } from './jedit-why-observation.js';

export function jeditCommandEventWithCurrentObservation(
  event: JeditCommandEvent,
  textAuthority: WorkspaceTextAuthority,
): JeditCommandEvent {
  return {
    ...event,
    observation: createJeditWhyObservation({
      basisDigest: event.basisDigest,
      receiptReferenceId: event.receiptId,
      target: event.target,
      textAuthority,
    }),
  };
}

export function workspaceTextAuthorityWithCurrentJeditCommandObservation(
  authority: WorkspaceTextAuthorityOpened,
): WorkspaceTextAuthorityOpened {
  return authority.lastCommandEvent == null
    ? authority
    : workspaceTextAuthorityWithLastCommandEvent(
      authority,
      jeditCommandEventWithCurrentObservation(authority.lastCommandEvent, authority),
    );
}
