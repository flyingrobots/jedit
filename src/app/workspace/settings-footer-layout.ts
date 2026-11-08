import { ensureEditorVisible, editorViewport } from './editor-session.js';
import { beginWorkspaceSourceHighlightRefresh } from './workspace-source-highlight.js';
import type { SourceHighlighter } from '../../ports/source-highlighter.js';
import { nextFilepathStyle } from '../../ports/filepath-style.js';
import type { Cmd } from '@flyingrobots/bijou-tui';
import { nextFooterLayout } from '../../ports/footer-preferences.js';
import type { FooterPreferencesPort } from '../../ports/footer-preferences.js';
import { NotificationPlacements, NotificationTones, NotificationVariants, pushNotificationToast } from '../../ui/feedback.js';
import type { JeditSettingsActivationDelta } from '../settings-session.js';
import type { WorkspaceModel } from './model.js';
import type { WorkspaceMsg } from './msg.js';

export interface FooterLayoutSettingsContext {
  readonly footerPreferences?: FooterPreferencesPort;
  readonly sourceHighlighter?: SourceHighlighter;
  readonly nowMs?: () => number;
  readonly createNotificationTickCmd?: () => Cmd<WorkspaceMsg>;
}

export function cycleWorkspaceFooterLayout(
  model: WorkspaceModel,
  delta: JeditSettingsActivationDelta,
  context: FooterLayoutSettingsContext,
): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  const layout = nextFooterLayout(model.footerLayout, delta);
  if (context.footerPreferences?.save(layout).ok !== false) return reconcileFooterViewport(model, { ...model, footerLayout: layout }, context);
  return footerPreferenceFailure(model, context);
}

function footerPreferenceFailure(model: WorkspaceModel, context: FooterLayoutSettingsContext): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  if (context.createNotificationTickCmd == null) return [model, []];
  return pushNotificationToast(model, {
    title: model.i18n.t('settings.toast.save_failed_title'),
    message: model.i18n.t('settings.toast.save_failed_message'),
    variant: NotificationVariants.Toast,
    tone: NotificationTones.Error,
    placement: NotificationPlacements.LowerRight,
  }, context.nowMs?.() ?? model.time, context.createNotificationTickCmd);
}

export function cycleWorkspaceFilepaths(model: WorkspaceModel, context: FooterLayoutSettingsContext): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  const filepathStyle = nextFilepathStyle(model.filepathStyle);
  if (context.footerPreferences?.saveFilepaths?.(filepathStyle).ok === false) return footerPreferenceFailure(model, context);
  return [{ ...model, filepathStyle }, []];
}

function reconcileFooterViewport(before: WorkspaceModel, model: WorkspaceModel, context: FooterLayoutSettingsContext): [WorkspaceModel, Cmd<WorkspaceMsg>[]] {
  const viewport = editorViewport(model);
  if (model.editor == null || viewport.height === editorViewport(before).height) return [model, []];
  const next = { ...model, editor: ensureEditorVisible(model.editor, viewport.width, viewport.height) };
  return context.sourceHighlighter == null ? [next, []] : beginWorkspaceSourceHighlightRefresh(next, viewport, context.sourceHighlighter);
}
