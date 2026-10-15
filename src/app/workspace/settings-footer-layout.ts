import type { Cmd } from '@flyingrobots/bijou-tui';
import { nextFooterLayout } from '../../ui/footer-layout.js';
import type { FooterPreferencesPort } from '../../ports/footer-preferences.js';
import { NotificationPlacements, NotificationTones, NotificationVariants, pushNotificationToast } from '../../ui/feedback.js';
import type { JeditSettingsActivationDelta } from '../settings-session.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';

export interface FooterLayoutSettingsContext {
  readonly footerPreferences?: FooterPreferencesPort;
  readonly nowMs?: () => number;
  readonly createNotificationTickCmd?: () => Cmd<WorkspaceMsg>;
}

export function cycleWorkspaceFooterLayout(
  model: WorkspaceModel,
  delta: JeditSettingsActivationDelta,
  context: FooterLayoutSettingsContext,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  const layout = nextFooterLayout(model.footerLayout, delta);
  if (context.footerPreferences?.save(layout).ok !== false) return [{ ...model, footerLayout: layout }, []];
  if (context.createNotificationTickCmd == null) return [model, []];
  return pushNotificationToast(model, {
    title: model.i18n.t('settings.toast.save_failed_title'),
    message: model.i18n.t('settings.toast.save_failed_message'),
    variant: NotificationVariants.Toast,
    tone: NotificationTones.Error,
    placement: NotificationPlacements.LowerRight,
  }, context.nowMs?.() ?? model.time, context.createNotificationTickCmd);
}
