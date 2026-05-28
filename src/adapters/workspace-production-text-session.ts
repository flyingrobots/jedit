import { TEXT_RUNTIME_PROFILE_ECHO_HOSTED, type TextRuntimeProfile } from '../app/text-runtime-profile.js';
import { createProductionTextSession, type ProductionTextSession } from '../app/workspace/production-text-session.js';
import { createTextRuntimeProfileSession } from './text-runtime-profile-session.js';

export interface WorkspaceTextRuntimeProfileOptions {
  readonly textRuntimeProfile?: TextRuntimeProfile;
  readonly seedTextRuntimeProfile?: TextRuntimeProfile;
}

export function resolveWorkspaceTextRuntimeProfile(options: WorkspaceTextRuntimeProfileOptions): TextRuntimeProfile {
  return options.textRuntimeProfile
    ?? options.seedTextRuntimeProfile
    ?? TEXT_RUNTIME_PROFILE_ECHO_HOSTED;
}

export function createWorkspaceProductionTextSession(
  profile: TextRuntimeProfile,
): ProductionTextSession {
  const textSessionBinding = createTextRuntimeProfileSession({ profile });
  return createProductionTextSession(textSessionBinding.session);
}
