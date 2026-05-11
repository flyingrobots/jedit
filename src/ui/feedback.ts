import {
  compositeSurface,
  modal,
  toast,
  type Cmd,
  type KeyMsg,
  type Overlay,
  type RuntimeIssue,
} from '@flyingrobots/bijou-tui';

import type { Surface } from '@flyingrobots/bijou';

const HELP_MODAL_WIDTH = 56;
const NOTICE_TITLE_SEPARATOR = ': ';
const RUNTIME_WARNING_TITLE = 'Runtime warning';
const RUNTIME_ERROR_TITLE = 'Runtime error';

export interface NoticeHost {
  readonly columns: number;
  readonly rows: number;
  readonly notice: string | null;
}

export function createFeedbackState() {
  return {
    notice: null,
    footerVisible: true,
  };
}

export function isFooterToggleKey(msg: KeyMsg): boolean {
  return (!msg.ctrl && !msg.alt && msg.key === '?')
    || (!msg.ctrl && !msg.alt && msg.shift && msg.key === '/');
}

export function clearNoticeOnKey<T extends NoticeHost>(model: T): T {
  if (model.notice === null) {
    return model;
  }

  return {
    ...model,
    notice: null,
  };
}

export function pushNoticeToast<Msg, T extends NoticeHost>(
  model: T,
  message: string,
): [T, Cmd<Msg>[]] {
  return [{
    ...model,
    notice: message,
  }, []];
}

export function pushErrorToast<Msg, T extends NoticeHost>(
  model: T,
  title: string,
  message: string,
): [T, Cmd<Msg>[]] {
  return pushNoticeToast(model, `${title}${NOTICE_TITLE_SEPARATOR}${message}`);
}

export function pushRuntimeIssueToast<Msg, T extends NoticeHost>(
  model: T,
  issue: RuntimeIssue,
): [T, Cmd<Msg>[]] {
  const title = issue.level === 'warning' ? RUNTIME_WARNING_TITLE : RUNTIME_ERROR_TITLE;
  return pushErrorToast(model, title, `${issue.source}${NOTICE_TITLE_SEPARATOR}${issue.message}`);
}

export function compositeFeedback(
  surface: Surface,
  notice: string | null,
  columns: number,
  rows: number,
  helpOverlay?: Overlay,
): Surface {
  const overlays = [
    ...(notice === null || notice.length === 0 ? [] : [toast({
      message: notice,
      variant: 'info',
      anchor: 'bottom-right',
      screenWidth: columns,
      screenHeight: rows,
    })]),
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
