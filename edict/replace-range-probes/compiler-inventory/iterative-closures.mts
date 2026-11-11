// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// Bind module source bytes before invoking the public compiler.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { draftSourcePaths, pinnedDrafts, sourceDigest } from './draft-modules.mjs';

type SourceFile = { path: string; source: string };
export const MODULE_CASES = ['module-fold', 'module-digest-negative', 'module-missing-negative'];
const DRAFT_ROOTS = new Map([['draft-text', 'Text'], ['draft-reference', 'Reference'],
    ['draft-rope', 'Rope'], ['draft-replace-range', 'ReplaceRange']]);
export const DRAFT_CASES = [...DRAFT_ROOTS.keys()];

function draftSources(root: string, name: string): SourceFile[] {
    const directory = path.join(root, 'drafts');
    const selected = DRAFT_ROOTS.get(name);
    if (!selected) throw new RangeError('unregistered draft root');
    const pinned = pinnedDrafts(directory);
    return draftSourcePaths(selected).map((relative: string, index: number) => {
        const file = path.basename(relative);
        const source = readFileSync(path.join(directory, file), 'utf8');
        if (source !== pinned.get(file.slice(0, -'.edict'.length))) throw new RangeError('stale draft source pin');
        return { path: index === 0 ? 'src/Probe.edict' : 'src/drafts/' + file, source };
    });
}

export function moduleSources(root: string, name: string, source: string): SourceFile[] {
    if (DRAFT_CASES.includes(name)) return draftSources(root, name);
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
