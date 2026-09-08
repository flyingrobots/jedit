#!/usr/bin/env node

// Renders JimLogo.svg into a small indexed-colour frame committed as source.
//
// This is a manual, documented step -- deliberately not part of `npm run check`.
// The previous generator ran on every gate and shelled out to ImageMagick, so a
// fresh checkout without it failed before a single test ran. The generated
// module below is committed, so building and testing jedit needs no image
// tooling at all; only regenerating the artwork does.
//
// rsvg-convert is used rather than ImageMagick because the logo carries its own
// opaque geometry. The old pipeline knocked out one specific background colour
// and flood-filled inward from the border, which was tuned to different artwork
// and produced an all-zero mask for this one.
//
// Usage: node scripts/generate-jim-logo-frame.mjs [--check]

import { spawnSync } from "node:child_process";
import zlib from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const SOURCE_PATH = path.resolve("JimLogo.svg");
const OUTPUT_PATH = path.resolve("src", "ui", "jim-logo-frame-data.ts");
const FRAME_SIZE = 192;
const RGBA_CHANNELS = 4;
const ALPHA_CHANNEL_OFFSET = 3;
const OPAQUE_ALPHA_THRESHOLD = 110;
const QUANTISE_STEP = 24;
const MAX_PALETTE_ENTRIES = 15;
const TRANSPARENT_INDEX = 0;
const CHECK_FLAG = "--check";
const RSVG_COMMAND = "rsvg-convert";
const MAX_RASTER_BYTES = FRAME_SIZE * FRAME_SIZE * RGBA_CHANNELS;
const BASE64_CHARS_PER_LINE = 120;
const NIBBLES_PER_BYTE = 2;
const PROCESS_SUCCESS = 0;
const TEXT_ENCODING = "utf8";

const rgba = renderRgba();
const { palette, indices } = quantise(rgba);
const generated = generatedModule(palette, indices);

if (process.argv.includes(CHECK_FLAG)) {
  const current = readFileSync(OUTPUT_PATH, TEXT_ENCODING);
  if (current !== generated) {
    throw new Error(`${path.relative(process.cwd(), OUTPUT_PATH)} is stale`);
  }
} else {
  writeFileSync(OUTPUT_PATH, generated);
}

function renderRgba() {
  const result = spawnSync(
    RSVG_COMMAND,
    [
      "-w", String(FRAME_SIZE),
      "-h", String(FRAME_SIZE),
      "-a",
      "--background-color=none",
      "-f", "png",
      SOURCE_PATH,
    ],
    { encoding: null, maxBuffer: MAX_RASTER_BYTES * 4 },
  );
  if (result.error != null) {
    throw result.error;
  }
  if (result.status !== PROCESS_SUCCESS) {
    throw new Error(result.stderr.toString(TEXT_ENCODING));
  }
  return decodePng(result.stdout);
}

// Minimal PNG reader: rsvg-convert emits 8-bit RGBA, non-interlaced.
function decodePng(bytes) {
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const body = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
    } else if (type === "IDAT") {
      idat.push(body);
    }
    offset += length + 12;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * RGBA_CHANNELS;
  const out = Buffer.alloc(stride * height);
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const current = Buffer.alloc(stride);
    for (let x = 0; x < stride; x += 1) {
      const a = x >= RGBA_CHANNELS ? current[x - RGBA_CHANNELS] : 0;
      const b = previous[x];
      const c = x >= RGBA_CHANNELS ? previous[x - RGBA_CHANNELS] : 0;
      current[x] = (line[x] + unfilter(filter, a, b, c)) & 0xff;
    }
    current.copy(out, y * stride);
    previous = current;
  }
  return out;
}

function unfilter(filter, a, b, c) {
  if (filter === 1) return a;
  if (filter === 2) return b;
  if (filter === 3) return Math.floor((a + b) / 2);
  if (filter === 4) return paeth(a, b, c);
  return 0;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function quantise(rgba) {
  const counts = new Map();
  for (let i = 0; i < rgba.length; i += RGBA_CHANNELS) {
    if (rgba[i + ALPHA_CHANNEL_OFFSET] < OPAQUE_ALPHA_THRESHOLD) {
      continue;
    }
    const key = bucketKey(rgba[i], rgba[i + 1], rgba[i + 2]);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const ranked = [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, MAX_PALETTE_ENTRIES)
    .map(([key]) => key);

  const palette = ranked.map(unbucketKey);
  const indices = new Uint8Array(FRAME_SIZE * FRAME_SIZE);
  for (let pixel = 0; pixel < indices.length; pixel += 1) {
    const i = pixel * RGBA_CHANNELS;
    if (rgba[i + ALPHA_CHANNEL_OFFSET] < OPAQUE_ALPHA_THRESHOLD) {
      indices[pixel] = TRANSPARENT_INDEX;
      continue;
    }
    indices[pixel] = nearest(palette, rgba[i], rgba[i + 1], rgba[i + 2]) + 1;
  }
  return { palette, indices };
}

function bucketKey(red, green, blue) {
  const q = (value) => Math.min(255, Math.round(value / QUANTISE_STEP) * QUANTISE_STEP);
  return `${q(red)},${q(green)},${q(blue)}`;
}

function unbucketKey(key) {
  return key.split(",").map(Number);
}

function nearest(palette, red, green, blue) {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < palette.length; i += 1) {
    const [pr, pg, pb] = palette[i];
    const distance = ((pr - red) ** 2) + ((pg - green) ** 2) + ((pb - blue) ** 2);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}

function generatedModule(palette, indices) {
  const paletteText = palette
    .map(([r, g, b]) => `  [${r}, ${g}, ${b}],`)
    .join("\n");

  // 16 values (transparent + 15 palette entries) fit one nibble, so two pixels
  // pack per byte. Base64 keeps the committed asset far smaller than a numeric
  // array literal and inside the repository line-length limit when chunked.
  const packed = Buffer.alloc(Math.ceil(indices.length / NIBBLES_PER_BYTE));
  for (let i = 0; i < indices.length; i += 1) {
    const value = indices[i] & 0x0f;
    if (i % NIBBLES_PER_BYTE === 0) {
      packed[i >> 1] = value << 4;
    } else {
      packed[i >> 1] |= value;
    }
  }
  const base64 = packed.toString("base64");
  const lines = [];
  for (let i = 0; i < base64.length; i += BASE64_CHARS_PER_LINE) {
    lines.push(`  "${base64.slice(i, i + BASE64_CHARS_PER_LINE)}",`);
  }

  return `// Generated by scripts/generate-jim-logo-frame.mjs from JimLogo.svg.
// Do not edit this file by hand. Regeneration is a manual step and requires
// rsvg-convert; building and testing jedit does not.

export const JIM_LOGO_FRAME_SIZE = ${FRAME_SIZE};

// Index 0 is transparent. Every other index is palette entry (index - 1).
export const JIM_LOGO_PALETTE: readonly (readonly [number, number, number])[] = [
${paletteText}
];

// Two 4-bit palette indices per byte, base64 encoded, row-major.
export const JIM_LOGO_PACKED_INDICES = [
${lines.join("\n")}
].join("");
`;
}
