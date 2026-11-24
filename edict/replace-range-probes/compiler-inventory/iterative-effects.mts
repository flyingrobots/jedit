// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// Select the standalone structured-effect lawpack and each effect case's application inputs.
import path from 'node:path';

export const EFFECT_GROUP = 'effects';
export const EFFECT_CASES = ['effect-linear', 'effect-repeated', 'effect-branch', 'effect-loop', 'effect-nested',
    'effect-dynamic-bound'];
/** Authored lawpack-build document in the hashed probe directory. */
export const EFFECT_LAWPACK_SOURCE = 'effects-lawpack.json';
/** Copy of that document, rebound to the selected provider, in the basis directory. */
export const EFFECT_LAWPACK_BUILD = 'effects.lawpack.json';
export const EFFECT_LAWPACK = 'jedit.inventory.effects@1';
const EFFECT_VENDOR = 'vendor/jedit-inventory-effects';
export const EFFECT_LAWPACK_OUTPUT = path.join(EFFECT_VENDOR, 'edict.lawpack-output.json');

/** The single application lawpack selection for a structured-effect case. */
export function effectLawpacks(): { manifest: string; exports: string; adapter: string; targetConfiguration: string }[] {
    return [{
        manifest: path.join(EFFECT_VENDOR, 'manifest.cbor'),
        exports: path.join(EFFECT_VENDOR, 'exports.cbor'),
        adapter: path.join(EFFECT_VENDOR, 'adapter.cbor'),
        targetConfiguration: path.join(EFFECT_VENDOR, 'create-configuration.cbor'),
    }];
}
