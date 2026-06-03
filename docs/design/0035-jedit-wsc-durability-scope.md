<!-- SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0 -->
<!-- © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots> -->

# jedit WSC Durability Scope

Status: slice 111 scope document.

## Claim

jedit becomes durably powered by Echo only when its production text authority
can survive process death through Echo causal-history evidence. The host
filesystem is an import/export boundary. It is not the durable authority for an
opened production buffer after Echo has admitted that buffer into a worldline.

This slice does not define a jedit-specific storage feature in Echo. It defines
the boundary that later slices must implement:

```text
jedit-owned import/export/path policy
-> generic Echo WSC causal-history persistence
-> jedit-owned recovery/materialization/export adapters
```

Echo persists generic causal history and retained evidence. jedit owns file
paths, text semantics, buffer policy, UI posture, and export artifacts.

## Durable Material

The WSC-backed history for a jedit production edit must retain enough generic
Echo evidence to recover:

- the worldline or site coordinate that hosted the edit;
- the accepted submission identity, if admission reached accepted posture;
- ticket or ingress correlation for accepted work;
- tick receipt or decided outcome correlation when work is decided;
- rejected or obstructed outcome posture when no edit was applied;
- reading envelope references for material shown to jedit;
- retained payload references required to materialize that reading;
- checkpoint or export evidence refs when jedit records them as app posture.

jedit may persist additional adapter-private placement metadata next to WSC
history, such as workspace-relative file paths. That metadata is not Echo
semantics and must not enter Echo core APIs as file, text, buffer, or editor
nouns.

## Restart States

Every restart must classify recovered history into one of these postures:

| State | Meaning | jedit behavior |
| --- | --- | --- |
| `not_accepted` | The edit never reached accepted Echo submission posture. | Keep host import explicit; do not invent pending work. |
| `pending` | Submission was accepted but no decided outcome was recovered. | Show pending posture; do not retry automatically. |
| `decided_applied` | Receipt says the edit applied under named law. | Restore materialized reading and receipt evidence. |
| `decided_rejected` | Receipt says the edit was rejected or conflicted. | Show final rejection; retry requires new user input. |
| `obstructed` | Required persisted evidence is missing or corrupt. | Fail closed with visible obstruction and no local authority fallback. |

Missing ticket, receipt, reading, payload, or commit-marker evidence is
`obstructed`, not "best effort." Host file bytes may be offered as a fresh
import only through an explicit import path.

## Export Boundary

Saving or exporting a file is a jedit materialization operation:

```text
selected Echo causal basis
-> bounded reading/materialization
-> jedit export adapter writes host bytes
```

Export does not mutate Echo causal history. If jedit wants to record the fact
that an export happened, that is app-owned posture over a reading/export
evidence ref. A failed export must not change the recovered Echo authority or
clear dirty, pending, stale, or obstructed posture.

## Out Of Scope

- Cross-device or adversarial replication.
- Blockchain-style consensus.
- jedit nouns in Echo persistence APIs.
- Treating WSC as a host-file backup format.
- Local undo stacks as production authority.
- Silent retry after restart.
- Historical export UI polish beyond the app-safe basis and materialization
  boundary.

## Slice Handoff

Slices 112-119 are Echo-side or cross-boundary durability primitives:

- generic WSC store port;
- accepted submission persistence;
- ticket and receipt correlation;
- reading and retention reference persistence;
- atomic commit markers;
- pending and decided recovery;
- half-accepted corruption rejection.

Slices 120-125 consume those primitives in jedit:

- workspace store adapter;
- startup recovery;
- edit-settlement persistence;
- restart round-trip proof;
- historical basis selection;
- current history export.
