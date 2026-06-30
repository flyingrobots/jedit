import { TEXT_RUNTIME_PROFILE_ECHO_HOSTED } from '../app/text-runtime-profile.js';
import { createProductionTextSession, type ProductionTextSession } from '../app/workspace/production-text-session.js';
import { createTextRuntimeProfileSession } from './text-runtime-profile-session.js';

export { createWorkspaceTextOperationSequencer } from '../app/workspace/workspace-text-operation-sequencer.js';

export function createWorkspaceProductionTextSession(): ProductionTextSession {
  const textSessionBinding = createTextRuntimeProfileSession({
    profile: TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
  });
  return createProductionTextSession(textSessionBinding.session);
}
