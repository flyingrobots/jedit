// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// Bind module source bytes before invoking the public compiler.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { sourceDigest } from './draft-modules.mjs';

type SourceFile = { path: string; source: string };
export const MODULE_CASES = ['module-fold', 'module-digest-negative', 'module-missing-negative'];

export function moduleSources(root: string, name: string, source: string): SourceFile[] {
    if (!MODULE_CASES.includes(name)) return [{ path: 'src/Probe.edict', source }];
    const leaf = readFileSync(path.join(root, 'modules/Leaf.edict'), 'utf8');
    const step = readFileSync(path.join(root, 'modules/Step.edict'), 'utf8')
        .replace('LEAF_DIGEST', sourceDigest(leaf));
    const files = [
        { path: 'src/Probe.edict', source: source.replace('STEP_DIGEST', sourceDigest(step)) },
        { path: 'src/modules/Step.edict', source: step },
    ];
    if (name !== 'module-missing-negative') files.push({ path: 'src/modules/Leaf.edict',
        source: name === 'module-digest-negative' ? leaf.replace('!value', 'value') : leaf });
    return files;
}
