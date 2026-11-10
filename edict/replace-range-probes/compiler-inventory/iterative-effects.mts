// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// Merge authored structured-effect declarations into the copied basis lawpack.
import { readFileSync } from 'node:fs';
import path from 'node:path';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };
export const EFFECT_GROUP = 'effects';
export const EFFECT_CASES = ['effect-linear', 'effect-repeated', 'effect-branch', 'effect-loop', 'effect-nested',
    'effect-dynamic-bound'];
export const EFFECT_ADDITIONS = 'structured-lawpack.json';
export const CREATE_CONFIGURATION = 'vendor/jedit-text/echo-create-configuration.cbor';

class EffectLawpackFailure extends Error {}

function object(value: Json | undefined, label: string): JsonObject {
    if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
        throw new EffectLawpackFailure('expected object: ' + label);
    }
    return value;
}

function list(value: Json | undefined, label: string): Json[] {
    if (!Array.isArray(value)) throw new EffectLawpackFailure('expected list: ' + label);
    return value;
}

function append(target: JsonObject, source: JsonObject, field: string): void {
    target[field] = [...list(target[field], field), ...list(source[field], field)];
}

function assign(target: JsonObject, source: JsonObject, field: string): void {
    const existing = object(target[field], field);
    for (const [key, value] of Object.entries(object(source[field], field))) {
        if (key in existing) throw new EffectLawpackFailure('effect addition replaces ' + field + '.' + key);
        existing[key] = value;
    }
}

/** Returns a copy of `basis` with every authored effect addition merged without replacement. */
export function withEffectAdditions(basis: JsonObject, fixtureRoot: string): JsonObject {
    const additions: JsonObject = JSON.parse(readFileSync(path.join(fixtureRoot, EFFECT_ADDITIONS), 'utf8'));
    const merged = structuredClone(basis);
    const lawpack = object(merged['lawpack'], 'lawpack');
    const exports = object(lawpack['exports'], 'exports');
    const added = object(additions['exports'], 'additions.exports');
    for (const field of ['types', 'effects', 'obstructions']) append(exports, added, field);
    assign(exports, added, 'operationProfiles');
    const adapters = list(lawpack['targetAdapters'], 'targetAdapters');
    if (adapters.length !== 1) throw new EffectLawpackFailure('expected exactly one target adapter');
    const adapter = object(adapters[0], 'targetAdapters[0]');
    for (const field of ['operationProfiles', 'effectImplementations', 'budgets']) assign(adapter, additions, field);
    lawpack['localResources'] = [...list(lawpack['localResources'], 'localResources'),
        object(additions['configuration'], 'configuration')];
    return merged;
}
