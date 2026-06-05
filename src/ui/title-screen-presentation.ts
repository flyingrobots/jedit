import { type Surface } from "@flyingrobots/bijou";
import { type JeditTheme } from "./jedit-theme.js";
import {
  flyingRobotsLogoCellBounds,
  paintFlyingRobotsLogo,
} from "./flyingrobots-logo.js";
import { paintTitleLogo, titleLogoCellBounds } from "./title-logo.js";
import {
  TITLE_SCREEN_TEXT_DIRECTION,
  titlePresentationSequence,
  type TitlePresentationSequence,
  type TitleScreenTextDirection,
} from "./title-presentation-sequence.js";
import {
  titleSceneMaterialColors,
  type TitleSceneMaterialColors,
} from "./title-scene-material-colors.js";

export type { TitleScreenTextDirection } from "./title-presentation-sequence.js";

interface TitlePresentationLogoPaintOptions {
  readonly cols: number;
  readonly rows: number;
  readonly time: number;
  readonly colors: TitleSceneMaterialColors;
  readonly sequence: TitlePresentationSequence;
}

export interface PaintTitleScreenPresentationOptions {
  readonly cols: number;
  readonly rows: number;
  readonly time: number;
  readonly theme: JeditTheme;
  readonly textDirection?: TitleScreenTextDirection;
}

export function paintTitleScreenPresentation(
  surface: Surface,
  options: PaintTitleScreenPresentationOptions,
): void {
  paintTitlePresentationLogos(surface, titlePresentationLogoOptions(options));
}

function titlePresentationLogoOptions(
  options: PaintTitleScreenPresentationOptions,
): TitlePresentationLogoPaintOptions {
  return {
    cols: options.cols,
    rows: options.rows,
    time: options.time,
    colors: titleSceneMaterialColors(options.theme),
    sequence: titlePresentationSequence(
      options.time,
      options.textDirection ?? TITLE_SCREEN_TEXT_DIRECTION.LeftToRight,
    ),
  };
}

function paintTitlePresentationLogos(
  surface: Surface,
  options: TitlePresentationLogoPaintOptions,
): void {
  paintFlyingRobotsLogo(
    surface,
    flyingRobotsLogoCellBounds(options.cols, options.rows),
    options.colors,
    options.time,
    {
      opacity: options.sequence.flyingRobotsOpacity,
    },
  );
  paintTitleLogo(
    surface,
    titleLogoCellBounds(options.cols, options.rows),
    options.colors,
    options.time,
    {
      opacity: options.sequence.titleOpacity,
      sheen: options.sequence.titleSheen,
    },
  );
}
