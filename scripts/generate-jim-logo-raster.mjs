#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const SOURCE_PATH = path.resolve("JimLogo.svg");
const OUTPUT_PATH = path.resolve("src", "ui", "jim-logo-raster-data.ts");
const RASTER_WIDTH = 56;
const RASTER_HEIGHT = 56;
const MASK_BYTES_PER_ROW = Math.ceil(RASTER_WIDTH / 8);
const BACKGROUND_COLOR = "#07101f";
const BACKGROUND_FUZZ = "8%";
const ALPHA_THRESHOLD = "25%";
const BYTE_BITS = 8;
const MASK_THRESHOLD = 127;
const MASK_VALUES_PER_LINE = 16;
const CHECK_MODE_FLAG = "--check";
const IMAGE_MAGICK_COMMAND = "magick";
const IMAGE_MAGICK_RESIZE_OPTION = "-resize";
const IMAGE_MAGICK_FUZZ_OPTION = "-fuzz";
const IMAGE_MAGICK_TRANSPARENT_OPTION = "-transparent";
const IMAGE_MAGICK_ALPHA_OPTION = "-alpha";
const IMAGE_MAGICK_ALPHA_EXTRACT = "extract";
const IMAGE_MAGICK_THRESHOLD_OPTION = "-threshold";
const IMAGE_MAGICK_DEPTH_OPTION = "-depth";
const IMAGE_MAGICK_GRAY_STDOUT = "gray:-";
const IMAGE_MAGICK_MAX_BYTES_PER_PIXEL = 4;
const IMAGE_MAGICK_FORCE_RESIZE_GEOMETRY =
  `${String(RASTER_WIDTH)}x${String(RASTER_HEIGHT)}!`;
const BINARY_OUTPUT_ENCODING = null;
const PROCESS_SUCCESS_STATUS = 0;
const TEXT_ENCODING = "utf8";
const NEIGHBOR_OFFSET_MIN = -1;
const NEIGHBOR_OFFSET_MAX = 1;
const CLEARED_MASK_VALUE = 0;
const FIRST_MASK_VALUE_INDEX = 0;
const MASK_VALUE_LINE_PREFIX = "  ";
const MASK_VALUE_SEPARATOR = ", ";
const MASK_VALUE_LINE_SUFFIX = ",";
const GENERATED_LINE_SEPARATOR = "\n";
const HASH_ALGORITHM = "sha256";
const HASH_DIGEST_ENCODING = "hex";

const source = readFileSync(SOURCE_PATH);
const raster = clearBoundaryConnectedMask(renderMask());
const packedMask = packMask(raster);
const generated = generatedModule(source, packedMask);

if (process.argv.includes(CHECK_MODE_FLAG)) {
  const current = readFileSync(OUTPUT_PATH, TEXT_ENCODING);
  if (current !== generated) {
    throw new Error(`${path.relative(process.cwd(), OUTPUT_PATH)} is stale`);
  }
} else {
  writeFileSync(OUTPUT_PATH, generated);
}

function renderMask() {
  const result = spawnSync(
    IMAGE_MAGICK_COMMAND,
    [
      SOURCE_PATH,
      IMAGE_MAGICK_RESIZE_OPTION,
      IMAGE_MAGICK_FORCE_RESIZE_GEOMETRY,
      IMAGE_MAGICK_FUZZ_OPTION,
      BACKGROUND_FUZZ,
      IMAGE_MAGICK_TRANSPARENT_OPTION,
      BACKGROUND_COLOR,
      IMAGE_MAGICK_ALPHA_OPTION,
      IMAGE_MAGICK_ALPHA_EXTRACT,
      IMAGE_MAGICK_THRESHOLD_OPTION,
      ALPHA_THRESHOLD,
      IMAGE_MAGICK_DEPTH_OPTION,
      String(BYTE_BITS),
      IMAGE_MAGICK_GRAY_STDOUT,
    ],
    {
      encoding: BINARY_OUTPUT_ENCODING,
      maxBuffer:
        RASTER_WIDTH * RASTER_HEIGHT * IMAGE_MAGICK_MAX_BYTES_PER_PIXEL,
    },
  );
  if (result.error != null) {
    throw result.error;
  }
  if (result.status !== PROCESS_SUCCESS_STATUS) {
    throw new Error(result.stderr.toString(TEXT_ENCODING));
  }
  const expectedLength = RASTER_WIDTH * RASTER_HEIGHT;
  if (result.stdout.length !== expectedLength) {
    throw new Error(
      `ImageMagick emitted ${String(result.stdout.length)} bytes; expected ${String(expectedLength)}`,
    );
  }
  return result.stdout;
}

function packMask(raster) {
  const packed = Buffer.alloc(MASK_BYTES_PER_ROW * RASTER_HEIGHT);
  for (let y = 0; y < RASTER_HEIGHT; y += 1) {
    for (let x = 0; x < RASTER_WIDTH; x += 1) {
      if (raster[(y * RASTER_WIDTH) + x] <= MASK_THRESHOLD) {
        continue;
      }
      const byteOffset = (y * MASK_BYTES_PER_ROW) + Math.floor(x / BYTE_BITS);
      packed[byteOffset] |= 1 << (BYTE_BITS - 1 - (x % BYTE_BITS));
    }
  }
  return packed;
}

function clearBoundaryConnectedMask(raster) {
  const cleaned = Buffer.from(raster);
  const queued = [];
  for (let x = 0; x < RASTER_WIDTH; x += 1) {
    enqueueBoundaryPixel(cleaned, queued, x, 0);
    enqueueBoundaryPixel(cleaned, queued, x, RASTER_HEIGHT - 1);
  }
  for (let y = 0; y < RASTER_HEIGHT; y += 1) {
    enqueueBoundaryPixel(cleaned, queued, 0, y);
    enqueueBoundaryPixel(cleaned, queued, RASTER_WIDTH - 1, y);
  }
  for (let index = 0; index < queued.length; index += 1) {
    const [x, y] = queued[index];
    for (
      let yOffset = NEIGHBOR_OFFSET_MIN;
      yOffset <= NEIGHBOR_OFFSET_MAX;
      yOffset += 1
    ) {
      for (
        let xOffset = NEIGHBOR_OFFSET_MIN;
        xOffset <= NEIGHBOR_OFFSET_MAX;
        xOffset += 1
      ) {
        enqueueBoundaryPixel(cleaned, queued, x + xOffset, y + yOffset);
      }
    }
  }
  return cleaned;
}

function enqueueBoundaryPixel(raster, queued, x, y) {
  if (x < 0 || y < 0 || x >= RASTER_WIDTH || y >= RASTER_HEIGHT) {
    return;
  }
  const offset = (y * RASTER_WIDTH) + x;
  if (raster[offset] <= MASK_THRESHOLD) {
    return;
  }
  raster[offset] = CLEARED_MASK_VALUE;
  queued.push([x, y]);
}

function generatedModule(sourceBytes, packedMask) {
  const sourceDigest = sha256(sourceBytes);
  const maskDigest = sha256(packedMask);
  const maskLines = maskValueLines(packedMask);
  return `// Generated by scripts/generate-jim-logo-raster.mjs from JimLogo.svg.\n\
// Do not edit this file by hand.\n\
\n\
export const JIM_LOGO_RASTER_WIDTH = ${String(RASTER_WIDTH)};\n\
export const JIM_LOGO_RASTER_HEIGHT = ${String(RASTER_HEIGHT)};\n\
export const JIM_LOGO_RASTER_MASK_BYTES_PER_ROW = ${String(MASK_BYTES_PER_ROW)};\n\
export const JIM_LOGO_RASTER_SOURCE_SHA256 = "${sourceDigest}";\n\
export const JIM_LOGO_RASTER_MASK_SHA256 = "${maskDigest}";\n\
export const JIM_LOGO_RASTER_MASK_BYTES = new Uint8Array([\n\
${maskLines}\n\
]);\n`;
}

function maskValueLines(packedMask) {
  const lines = [];
  for (
    let index = FIRST_MASK_VALUE_INDEX;
    index < packedMask.length;
    index += MASK_VALUES_PER_LINE
  ) {
    const values = Array.from(
      packedMask.subarray(index, index + MASK_VALUES_PER_LINE),
      String,
    );
    lines.push(
      `${MASK_VALUE_LINE_PREFIX}${values.join(MASK_VALUE_SEPARATOR)}${MASK_VALUE_LINE_SUFFIX}`,
    );
  }
  return lines.join(GENERATED_LINE_SEPARATOR);
}

function sha256(bytes) {
  return createHash(HASH_ALGORITHM)
    .update(bytes)
    .digest(HASH_DIGEST_ENCODING);
}
