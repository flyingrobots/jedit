import {
  TITLE_LOGO_SHEEN_DIRECTION,
  type TitleLogoSheen,
} from "./title-logo.js";
import {
  TITLE_SCENE_DEFAULT_DIRECTOR_TIMELINE,
  titleSceneCueOpacity,
  titleSceneCueProgress,
} from "./title-scene-director.js";

export const TITLE_SCREEN_TEXT_DIRECTION = {
  LeftToRight: TITLE_LOGO_SHEEN_DIRECTION.LeftToRight,
  RightToLeft: TITLE_LOGO_SHEEN_DIRECTION.RightToLeft,
} as const;

export type TitleScreenTextDirection =
  (typeof TITLE_SCREEN_TEXT_DIRECTION)[keyof typeof TITLE_SCREEN_TEXT_DIRECTION];

export interface TitlePresentationSequence {
  readonly flyingRobotsOpacity: number;
  readonly titleOpacity: number;
  readonly titleSheen?: TitleLogoSheen;
}

export function titlePresentationSequence(
  time: number,
  textDirection: TitleScreenTextDirection,
): TitlePresentationSequence {
  const timeline = TITLE_SCENE_DEFAULT_DIRECTOR_TIMELINE;
  const titleOpacity = titleSceneCueOpacity(time, timeline.titleLogo);
  return {
    flyingRobotsOpacity: titleSceneCueOpacity(time, timeline.flyingRobotsLogo),
    titleOpacity,
    titleSheen:
      titleOpacity <= 0 ? undefined : titleLogoSheenAt(time, textDirection),
  };
}

function titleLogoSheenAt(
  time: number,
  textDirection: TitleScreenTextDirection,
): TitleLogoSheen | undefined {
  const progress = titleSceneCueProgress(
    time,
    TITLE_SCENE_DEFAULT_DIRECTOR_TIMELINE.titleLogoSheen,
  );
  if (progress == null) {
    return undefined;
  }

  return {
    progress,
    direction:
      textDirection === TITLE_SCREEN_TEXT_DIRECTION.RightToLeft
        ? TITLE_LOGO_SHEEN_DIRECTION.RightToLeft
        : TITLE_LOGO_SHEEN_DIRECTION.LeftToRight,
  };
}
