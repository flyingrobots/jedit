import {
  compositeSurface,
  createNotificationState,
  modal,
  notificationsNeedTick,
  pushNotification,
  renderNotificationStack,
  tickNotifications,
  trimNotificationsToViewport,
  type Cmd,
  type KeyMsg,
  type NotificationSpec,
  type NotificationState,
  type Overlay,
  type RuntimeIssue,
} from '@flyingrobots/bijou-tui';

import type { Surface } from '@flyingrobots/bijou';

const HELP_MODAL_WIDTH = 56;
const NOTIFICATION_TICK_MS = 40;

export interface NotificationHost<Msg> {
  readonly columns: number;
  readonly rows: number;
  readonly notifications: NotificationState<Msg>;
  readonly notificationLoopActive: boolean;
}

export function createFeedbackState<Msg>() {
  return {
    notifications: createNotificationState<Msg>(),
    notificationLoopActive: false,
    footerVisible: true,
  };
}

export function isFooterToggleKey(msg: KeyMsg): boolean {
  return (!msg.ctrl && !msg.alt && msg.key === '?')
    || (!msg.ctrl && !msg.alt && msg.shift && msg.key === '/');
}

export function createNotificationTickCmd<Msg>(createMsg: (atMs: number) => Msg): Cmd<Msg> {
  return async (_emit, caps) => {
    if (!caps.sleep) {
      throw new Error('Notification ticking requires sleep capability.');
    }

    await caps.sleep(NOTIFICATION_TICK_MS);
    return createMsg(caps.now?.() ?? Date.now());
  };
}

export function applyNotificationState<Msg, T extends NotificationHost<Msg>>(
  model: T,
  notifications: NotificationState<Msg>,
  nowMs: number,
  createTickCmd: () => Cmd<Msg>,
  forceTick = false,
): [T, Cmd<Msg>[]] {
  const trimmed = trimNotificationsToViewport(notifications, {
    screenWidth: model.columns,
    screenHeight: model.rows,
  }, nowMs);
  const needsTick = notificationsNeedTick(trimmed);
  const next = {
    ...model,
    notifications: trimmed,
    notificationLoopActive: needsTick,
  };

  if (needsTick && (forceTick || !model.notificationLoopActive)) {
    return [next, [createTickCmd()]];
  }

  return [next, []];
}

export function pushNotificationToast<Msg, T extends NotificationHost<Msg>>(
  model: T,
  spec: NotificationSpec<Msg>,
  nowMs: number,
  createTickCmd: () => Cmd<Msg>,
): [T, Cmd<Msg>[]] {
  return applyNotificationState(
    model,
    pushNotification(model.notifications, spec, nowMs),
    nowMs,
    createTickCmd,
  );
}

export function pushErrorToast<Msg, T extends NotificationHost<Msg>>(
  model: T,
  title: string,
  message: string,
  nowMs: number,
  createTickCmd: () => Cmd<Msg>,
): [T, Cmd<Msg>[]] {
  return pushNotificationToast(model, {
    title,
    message,
    variant: 'TOAST',
    tone: 'ERROR',
    placement: 'BOTTOM_CENTER',
  }, nowMs, createTickCmd);
}

export function pushRuntimeIssueToast<Msg, T extends NotificationHost<Msg>>(
  model: T,
  issue: RuntimeIssue,
  createTickCmd: () => Cmd<Msg>,
): [T, Cmd<Msg>[]] {
  return pushNotificationToast(model, {
    title: issue.level === 'warning' ? 'Runtime warning' : 'Runtime error',
    message: `${issue.source}: ${issue.message}`,
    variant: 'TOAST',
    tone: issue.level === 'warning' ? 'WARNING' : 'ERROR',
    placement: 'BOTTOM_CENTER',
  }, issue.atMs, createTickCmd);
}

export function tickNotificationState<Msg, T extends NotificationHost<Msg>>(
  model: T,
  nowMs: number,
  createTickCmd: () => Cmd<Msg>,
): [T, Cmd<Msg>[]] {
  return applyNotificationState(
    model,
    tickNotifications(model.notifications, nowMs),
    nowMs,
    createTickCmd,
    true,
  );
}

export function compositeFeedback<Msg>(
  surface: Surface,
  notifications: NotificationState<Msg>,
  columns: number,
  rows: number,
  helpOverlay?: Overlay,
): Surface {
  const overlays = [
    ...renderNotificationStack(notifications, {
      screenWidth: columns,
      screenHeight: rows,
    }),
    ...(helpOverlay == null ? [] : [helpOverlay]),
  ];

  if (overlays.length === 0) {
    return surface;
  }

  return compositeSurface(surface, overlays, helpOverlay == null ? undefined : { dim: true });
}

export function renderHelpOverlay(
  columns: number,
  rows: number,
  title: string,
  body: string,
  hint: string,
): Overlay {
  return modal({
    title,
    body,
    hint,
    screenWidth: columns,
    screenHeight: rows,
    width: HELP_MODAL_WIDTH,
  });
}
