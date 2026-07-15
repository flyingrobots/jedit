import assert from 'node:assert/strict';
import { importDist } from '../dist-helpers.mjs';

export const UTF8_ENCODER = new TextEncoder();

export async function loadModules() {
  const [runtime, contract] = await Promise.all([
    importDist('domain', 'graph-rope-runtime.js'),
    importDist('domain', 'graph-rope-contract.js'),
  ]);
  return { runtime, contract };
}

export function createHashPort() {
  return {
    sha256Hex(value) {
      return `hash(${value})`;
    },
  };
}

export function assertOk(result) {
  assert.equal(result.ok, true);
  return result.value ?? result.fact ?? result;
}

export function byteRange(contract, start, end) {
  return assertOk(contract.makeTextByteRange(
    assertOk(contract.makeByteOffset(start)),
    assertOk(contract.makeByteOffset(end)),
  ));
}
