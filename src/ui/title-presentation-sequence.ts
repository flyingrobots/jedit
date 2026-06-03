import { TITLE_LOGO_SHEEN_DIRECTION, type TitleLogoSheen } from './title-logo.js';

export type TitleScreenTextDirection = 'ltr' | 'rtl';

export interface TitlePresentationSequence {
  readonly flyingRobotsOpacity: number;
  readonly titleOpacity: number;
  readonly titleSheen?: TitleLogoSheen;
}

const TITLE_TEXT_DIRECTION_RTL = 'rtl';
const TITLE_SEQUENCE_FLYINGROBOTS_APPEAR_SECONDS = 0;
const TITLE_SEQUENCE_TITLE_APPEAR_SECONDS = 2;
const TITLE_SEQUENCE_SHEEN_START_SECONDS = 3;
const TITLE_SEQUENCE_COMPLETE_SECONDS = 7;
const TITLE_SEQUENCE_FADE_DURATION_SECONDS = 0;
const TITLE_SEQUENCE_SHEEN_DURATION_SECONDS = 2;

export function titlePresentationSequence(
  time: number,
  textDirection: TitleScreenTextDirection,
): TitlePresentationSequence {
  const titleOpacity = titleSequenceOpacity(
    time,
    TITLE_SEQUENCE_TITLE_APPEAR_SECONDS,
    TITLE_SEQUENCE_COMPLETE_SECONDS,
    TITLE_SEQUENCE_FADE_DURATION_SECONDS,
  );
  return {
    flyingRobotsOpacity: titleSequenceOpacity(
      time,
      TITLE_SEQUENCE_FLYINGROBOTS_APPEAR_SECONDS,
      TITLE_SEQUENCE_COMPLETE_SECONDS,
      TITLE_SEQUENCE_FADE_DURATION_SECONDS,
    ),
    titleOpacity,
    titleSheen: titleOpacity <= 0 ? undefined : titleLogoSheenAt(time, textDirection),
  };
}

function titleLogoSheenAt(time: number, textDirection: TitleScreenTextDirection): TitleLogoSheen | undefined {
  if (
    time < TITLE_SEQUENCE_SHEEN_START_SECONDS
    || time > TITLE_SEQUENCE_SHEEN_START_SECONDS + TITLE_SEQUENCE_SHEEN_DURATION_SECONDS
  ) {
    return undefined;
  }

  return {
    progress: clampTitleSequenceRatio(
      (time - TITLE_SEQUENCE_SHEEN_START_SECONDS)
        / TITLE_SEQUENCE_SHEEN_DURATION_SECONDS,
    ),
    direction: textDirection === TITLE_TEXT_DIRECTION_RTL
      ? TITLE_LOGO_SHEEN_DIRECTION.RightToLeft
      : TITLE_LOGO_SHEEN_DIRECTION.LeftToRight,
  };
}

function titleSequenceOpacity(
  time: number,
  appearAt: number,
  fadeAt: number,
  fadeDuration: number,
): number {
  if (time < appearAt || time >= fadeAt + fadeDuration) {
    return 0;
  }
  if (fadeDuration === 0 || time < fadeAt) {
    return 1;
  }
  return clampTitleSequenceRatio(1 - ((time - fadeAt) / fadeDuration));
}

function clampTitleSequenceRatio(value: number): number {
  return Math.max(0, Math.min(1, value));
}
