// sRGB <-> OKLab/OKLCH, from Björn Ottosson's published derivation.
//
// Hand-rolled rather than pulled from culori because jedit ships no colour
// dependency today and this is the whole of what it needs: two matrices, a
// cube root, and the sRGB transfer function. The constants are exact values
// from the reference implementation, and oklch.spec.mjs checks them against
// known conversions rather than against themselves.
//
// OKLCH is used instead of HSL because the logo has to keep a stable perceived
// lightness across hues: HSL's L is a channel average, so recolouring artwork
// through it makes blues read far darker than yellows at the same nominal L.

export interface Oklch {
  readonly lightness: number;
  readonly chroma: number;
  readonly hue: number;
}

export type Rgb = readonly [number, number, number];

const SRGB_MAX = 255;
const GAMMA_THRESHOLD_ENCODED = 0.04045;
const GAMMA_THRESHOLD_LINEAR = 0.0031308;
const GAMMA_LINEAR_SLOPE = 12.92;
const GAMMA_OFFSET = 0.055;
const GAMMA_SCALE = 1.055;
const GAMMA_EXPONENT = 2.4;
const GAMMA_INVERSE_EXPONENT = 1 / 2.4;
const CUBE = 3;
const DEGREES_PER_TURN = 360;
const HALF_TURN = 180;
const ZERO = 0;
const ONE = 1;

function toLinear(channel: number): number {
  const ratio = channel / SRGB_MAX;
  return ratio <= GAMMA_THRESHOLD_ENCODED
    ? ratio / GAMMA_LINEAR_SLOPE
    : Math.pow((ratio + GAMMA_OFFSET) / GAMMA_SCALE, GAMMA_EXPONENT);
}

function toEncoded(linear: number): number {
  const clamped = Math.min(ONE, Math.max(ZERO, linear));
  const ratio = clamped <= GAMMA_THRESHOLD_LINEAR
    ? clamped * GAMMA_LINEAR_SLOPE
    : (GAMMA_SCALE * Math.pow(clamped, GAMMA_INVERSE_EXPONENT)) - GAMMA_OFFSET;
  return Math.round(ratio * SRGB_MAX);
}

export function rgbToOklch(rgb: Rgb): Oklch {
  const red = toLinear(rgb[0]);
  const green = toLinear(rgb[1]);
  const blue = toLinear(rgb[2]);

  const long = Math.cbrt((0.4122214708 * red) + (0.5363325363 * green) + (0.0514459929 * blue));
  const medium = Math.cbrt((0.2119034982 * red) + (0.6806995451 * green) + (0.1073969566 * blue));
  const short = Math.cbrt((0.0883024619 * red) + (0.2817188376 * green) + (0.6299787005 * blue));

  const lightness = (0.2104542553 * long) + (0.7936177850 * medium) - (0.0040720468 * short);
  const greenRed = (1.9779984951 * long) - (2.4285922050 * medium) + (0.4505937099 * short);
  const blueYellow = (0.0259040371 * long) + (0.7827717662 * medium) - (0.8086757660 * short);

  const hue = (Math.atan2(blueYellow, greenRed) * DEGREES_PER_TURN) / (2 * Math.PI);
  return {
    lightness,
    chroma: Math.hypot(greenRed, blueYellow),
    hue: hue < ZERO ? hue + DEGREES_PER_TURN : hue,
  };
}

export function oklchToRgb(color: Oklch): Rgb {
  const radians = (color.hue * 2 * Math.PI) / DEGREES_PER_TURN;
  const greenRed = color.chroma * Math.cos(radians);
  const blueYellow = color.chroma * Math.sin(radians);

  const long = ((color.lightness + (0.3963377774 * greenRed) + (0.2158037573 * blueYellow)) ** CUBE);
  const medium = ((color.lightness - (0.1055613458 * greenRed) - (0.0638541728 * blueYellow)) ** CUBE);
  const short = ((color.lightness - (0.0894841775 * greenRed) - (1.2914855480 * blueYellow)) ** CUBE);

  return [
    toEncoded((4.0767416621 * long) - (3.3077115913 * medium) + (0.2309699292 * short)),
    toEncoded((-1.2684380046 * long) + (2.6097574011 * medium) - (0.3413193965 * short)),
    toEncoded((-0.0041960863 * long) - (0.7034186147 * medium) + (1.7076147010 * short)),
  ];
}

// Shortest way round the hue circle, so a rotation from 350 to 10 travels 20
// degrees forward rather than 340 back. Exact opposites are equally far in
// both directions; the tie is broken forwards so the result is a stated
// convention rather than a consequence of how the modulo happens to land.
export function mixHue(from: number, to: number, amount: number): number {
  const forward = (((to - from) % DEGREES_PER_TURN) + DEGREES_PER_TURN) % DEGREES_PER_TURN;
  const delta = forward > HALF_TURN ? forward - DEGREES_PER_TURN : forward;
  const mixed = (from + (delta * amount)) % DEGREES_PER_TURN;
  return mixed < ZERO ? mixed + DEGREES_PER_TURN : mixed;
}
