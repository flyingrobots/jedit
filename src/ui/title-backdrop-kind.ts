const STATIC_LOGO = 'static-logo';
const LEGACY_SCENE = 'legacy-scene';

export const TITLE_BACKDROP_KIND = Object.freeze({
  StaticLogo: STATIC_LOGO,
  LegacyScene: LEGACY_SCENE,
});

export type TitleBackdropKind =
  (typeof TITLE_BACKDROP_KIND)[keyof typeof TITLE_BACKDROP_KIND];
