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

// A triple in whatever space the surrounding step is working in -- linear sRGB,
// cone response (LMS), or Oklab. Named apart from Rgb so a cone-response triple
// is not mistaken for a colour.
type Triple = readonly [number, number, number];
type Matrix3 = readonly [Triple, Triple, Triple];

// The four matrices of Ottosson's derivation, transcribed from the reference
// implementation. The two directions are inverses of one another, not shared
// coefficients, so each is written out rather than derived from its partner --
// inverting at runtime would introduce error the published values do not have.
// oklch.spec.mjs checks them against his reference conversions.
const LINEAR_RGB_TO_CONE: Matrix3 = [
  [0.4122214708, 0.5363325363, 0.0514459929],
  [0.2119034982, 0.6806995451, 0.1073969566],
  [0.0883024619, 0.2817188376, 0.6299787005],
];

const CONE_TO_OKLAB: Matrix3 = [
  [0.2104542553, 0.7936177850, -0.0040720468],
  [1.9779984951, -2.4285922050, 0.4505937099],
  [0.0259040371, 0.7827717662, -0.8086757660],
];

const OKLAB_TO_CONE: Matrix3 = [
  [1, 0.3963377774, 0.2158037573],
  [1, -0.1055613458, -0.0638541728],
  [1, -0.0894841775, -1.2914855480],
];

const CONE_TO_LINEAR_RGB: Matrix3 = [
  [4.0767416621, -3.3077115913, 0.2309699292],
  [-1.2684380046, 2.6097574011, -0.3413193965],
  [-0.0041960863, -0.7034186147, 1.7076147010],
];

function transform(matrix: Matrix3, input: Triple): Triple {
  return [
    dot(matrix[0], input),
    dot(matrix[1], input),
    dot(matrix[2], input),
  ];
}

function dot(row: Triple, input: Triple): number {
  return (row[0] * input[0]) + (row[1] * input[1]) + (row[2] * input[2]);
}

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
  const linear: Triple = [toLinear(rgb[0]), toLinear(rgb[1]), toLinear(rgb[2])];
  const cone = transform(LINEAR_RGB_TO_CONE, linear);
  // The cube root is what makes the space perceptual rather than linear.
  const compressed: Triple = [Math.cbrt(cone[0]), Math.cbrt(cone[1]), Math.cbrt(cone[2])];
  const [lightness, greenRed, blueYellow] = transform(CONE_TO_OKLAB, compressed);

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

  const compressed = transform(OKLAB_TO_CONE, [color.lightness, greenRed, blueYellow]);
  const cone: Triple = [compressed[0] ** CUBE, compressed[1] ** CUBE, compressed[2] ** CUBE];
  const linear = transform(CONE_TO_LINEAR_RGB, cone);

  return [toEncoded(linear[0]), toEncoded(linear[1]), toEncoded(linear[2])];
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
