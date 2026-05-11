import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { TitleMeshSource, TitleMeshTriangle, TitleMeshVector3 } from '../ports/title-mesh.js';
import {
  ObjFaceIndexOutOfRangeError,
  ObjFaceNotTriangleError,
  ObjInvalidFaceIndexError,
  ObjInvalidVertexCoordinateError,
} from '../domain/errors.js';

const UTF8_ENCODING = 'utf8';
const OBJ_VERTEX_PREFIX = 'v ';
const OBJ_FACE_PREFIX = 'f ';
const OBJ_FACE_VERTEX_SEPARATOR = '/';
const LINE_BREAK_PATTERN = /\r?\n/;
const TOKEN_SEPARATOR_PATTERN = /\s+/;
const OBJ_INDEX_BASE = 1;
const VERTEX_X_TOKEN = 1;
const VERTEX_Y_TOKEN = 2;
const VERTEX_Z_TOKEN = 3;
const FACE_FIRST_TOKEN = 1;
const FACE_SECOND_TOKEN = 2;
const FACE_THIRD_TOKEN = 3;
const FACE_TOKEN_COUNT = 4;

const TITLE_BUNNY_MESH_ASSET_URLS = [
  new URL('../ui/bunny.obj', import.meta.url),
  new URL('../../src/ui/bunny.obj', import.meta.url),
] as const;

export function loadTitleBunnyMeshSource(): TitleMeshSource {
  return decodeObjMeshSource(readFileSync(titleBunnyMeshAssetPath(), UTF8_ENCODING));
}

export function decodeObjMeshSource(source: string): TitleMeshSource {
  const vertices: TitleMeshVector3[] = [];
  const triangles: TitleMeshTriangle[] = [];
  const lines = source.split(LINE_BREAK_PATTERN);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? '';
    const lineNumber = index + 1;
    if (line.startsWith(OBJ_VERTEX_PREFIX)) {
      vertices.push(decodeVertexLine(line, lineNumber));
      continue;
    }
    if (line.startsWith(OBJ_FACE_PREFIX)) {
      triangles.push(decodeFaceLine(line, vertices.length, lineNumber));
    }
  }

  return { vertices, triangles };
}

function titleBunnyMeshAssetPath(): string {
  for (const assetUrl of TITLE_BUNNY_MESH_ASSET_URLS) {
    const filePath = fileURLToPath(assetUrl);
    if (existsSync(filePath)) {
      return filePath;
    }
  }
  return fileURLToPath(TITLE_BUNNY_MESH_ASSET_URLS[0]);
}

function decodeVertexLine(line: string, lineNumber: number): TitleMeshVector3 {
  const tokens = line.split(TOKEN_SEPARATOR_PATTERN);
  return [
    decodeNumber(tokens[VERTEX_X_TOKEN], lineNumber),
    decodeNumber(tokens[VERTEX_Y_TOKEN], lineNumber),
    decodeNumber(tokens[VERTEX_Z_TOKEN], lineNumber),
  ];
}

function decodeFaceLine(line: string, vertexCount: number, lineNumber: number): TitleMeshTriangle {
  const tokens = line.split(TOKEN_SEPARATOR_PATTERN);
  if (tokens.length !== FACE_TOKEN_COUNT) {
    throw new ObjFaceNotTriangleError(`OBJ face at line ${lineNumber} is not a triangle.`);
  }
  return [
    decodeFaceIndex(tokens[FACE_FIRST_TOKEN], vertexCount, lineNumber),
    decodeFaceIndex(tokens[FACE_SECOND_TOKEN], vertexCount, lineNumber),
    decodeFaceIndex(tokens[FACE_THIRD_TOKEN], vertexCount, lineNumber),
  ];
}

function decodeFaceIndex(token: string | undefined, vertexCount: number, lineNumber: number): number {
  const rawIndex = token?.split(OBJ_FACE_VERTEX_SEPARATOR)[0] ?? '';
  const parsed = Number(rawIndex);
  if (!Number.isInteger(parsed)) {
    throw new ObjInvalidFaceIndexError(`OBJ face index at line ${lineNumber} is invalid.`);
  }

  const index = parsed > 0 ? parsed - OBJ_INDEX_BASE : vertexCount + parsed;
  if (index < 0 || index >= vertexCount) {
    throw new ObjFaceIndexOutOfRangeError(`OBJ face index at line ${lineNumber} is out of range.`);
  }
  return index;
}

function decodeNumber(token: string | undefined, lineNumber: number): number {
  const value = Number(token);
  if (!Number.isFinite(value)) {
    throw new ObjInvalidVertexCoordinateError(`OBJ vertex coordinate at line ${lineNumber} is invalid.`);
  }
  return value;
}
