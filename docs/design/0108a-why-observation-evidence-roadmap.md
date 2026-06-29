---
title: "WF-0108A - :why Observation Evidence Roadmap"
legend: "WF"
lane: "design"
issue: "https://github.com/flyingrobots/jedit/issues/181"
status: "active"
owners:
  - "@flyingrobots"
created: "2026-06-29"
updated: "2026-06-29"
---

# WF-0108A - :why Observation Evidence Roadmap

## Linked Issue

- [#181 WF-0108A: Complete `:why` through observation evidence](https://github.com/flyingrobots/jedit/issues/181)

## Decision Summary

`:why` is a Jim feature. It should explain the last meaningful Jim command in
product terms, while carrying enough evidence posture for humans, agents, and
future debugging surfaces to tell what was native, missing, stale, or
obstructed.

WF-0108 already landed the narrow command-dispatch and local command-provenance
base. WF-0108A closes the remaining gap by wiring `:why` to Echo-backed reading
identity, typed evidence obstructions, and future proof slots without moving
Jim editor nouns into Echo or pretending that Jim/Echo integration goes through
Continuum.

## Product Boundary

The ownership split is deliberately strict:

| Layer | Owns | Does not own |
| --- | --- | --- |
| Jim / jedit | `:why` UX, command catalog, Vim command grammar, editor facts, JSON witness shape | Runtime admission or generic protocol doctrine |
| Echo | Reading envelopes, receipts, retained evidence, runtime admission, replayable basis facts | Jim commands, Vim nouns, buffers, registers, macros |
| Continuum | Portable profile vocabulary, evidence posture, participant discovery, conformance fixtures | Jim/Echo app integration, runtime implementation, editor app ontology |

Jim is an Echo app. Jim does not talk to Echo through Continuum. Continuum
becomes relevant only where Jim/Echo evidence needs to be portable to WARP TTD,
Graft, WARP DRIVE, agents, or other Continuum participants.

## Current Source Truth

Current builds already contain the first `:why` proof:

- command-line dispatch for `:why`;
- a command event model for meaningful Vim-powered edits;
- a calm no-event response when no meaningful command is available;
- human-facing explanation surfaces;
- agent-facing witness paths for the local command event.

The remaining production gap is observation evidence:

- `:why` must name the Echo reading identity or obstruction posture it depended
  on;
- unsupported, stale, missing, or translated evidence must be typed instead of
  collapsed into prose;
- the first golden commands must prove the same command facts through runtime
  behavior, JSON, and human explanation;
- cryptographic proof posture should have reserved fields, but fake proof
  strength must not be claimed before Echo and Continuum can witness it.

## Goalpost

The active jedit goalpost is:

- [#181 WF-0108A: Complete `:why` through observation evidence](https://github.com/flyingrobots/jedit/issues/181)

It is complete when a user can run a representative Vim command, ask `:why`,
and receive an explanation that includes:

- parsed command identity;
- resolved target or typed obstruction;
- affected range or transform;
- register and lower-mode effects where relevant;
- Echo reading basis or explicit missing-evidence posture;
- receipt or retained evidence refs when available;
- JSON witness fields matching the human-facing truth.

## Jedit Slices

| Issue | Slice | Proof |
| --- | --- | --- |
| [#173](https://github.com/flyingrobots/jedit/issues/173) | Lock WF-0108A roadmap and cross-repo issue links | Docs name ownership, order, and evidence boundaries |
| [#174](https://github.com/flyingrobots/jedit/issues/174) | Add `JeditWhyObservation` coordinate model | Model test proves basis/window/authority fields |
| [#175](https://github.com/flyingrobots/jedit/issues/175) | Upgrade text-window envelope evidence fields | Window evidence distinguishes full, partial, stale, and unavailable |
| [#176](https://github.com/flyingrobots/jedit/issues/176) | Wire `:why` JSON to Echo ReadingEnvelope identity | JSON witness includes Echo reading identity or obstruction |
| [#177](https://github.com/flyingrobots/jedit/issues/177) | Add typed `:why` evidence obstructions | Unsupported and stale cases return machine-readable posture |
| [#178](https://github.com/flyingrobots/jedit/issues/178) | Golden `dw` witness through Echo evidence | Human and JSON `:why` agree for `dw` |
| [#179](https://github.com/flyingrobots/jedit/issues/179) | Expand witness to `dd`, `ciw`, and `gUap` | Each command proves command, target, range, and evidence facts |
| [#180](https://github.com/flyingrobots/jedit/issues/180) | Add proof posture slots for future crypto evidence | Schema reserves proof posture without overclaiming |

## Echo Dependencies

Echo work is required where `:why` needs runtime evidence, not editor semantics:

| Issue | Slice | Why Jim needs it |
| --- | --- | --- |
| [echo#628](https://github.com/flyingrobots/echo/issues/628) | Export ReadingEnvelope identity for app consumers | Lets Jim cite the reading it observed |
| [echo#629](https://github.com/flyingrobots/echo/issues/629) | Stabilize contract obstruction taxonomy for Jim | Lets Jim report typed missing/stale evidence |
| [echo#630](https://github.com/flyingrobots/echo/issues/630) | Return retained receipt and reading evidence refs | Lets `:why` cite real runtime evidence |
| [echo#631](https://github.com/flyingrobots/echo/issues/631) | Preserve trusted-host scheduler split for jedit witness | Prevents app code from claiming runtime admission authority |
| [echo#632](https://github.com/flyingrobots/echo/issues/632) | Add replay proof for Jim edit and bounded reading | Makes recovery/debug claims evidence-backed |
| [echo#633](https://github.com/flyingrobots/echo/issues/633) | Define canonical digest domains for observation evidence | Stabilizes future proof posture and comparison |

Echo must not learn Jim, Vim, buffers, registers, macros, or `:why`. It should
export generic runtime evidence that Jim can project into editor language.

## Continuum Dependencies

Continuum work is protocol work. It is not on the Jim-to-Echo call path.

Relevant Continuum goalposts:

- [continuum#59](https://github.com/flyingrobots/continuum/issues/59) tracks
  observation evidence and capability proof protocol slices.
- [continuum#58](https://github.com/flyingrobots/continuum/issues/58) tracks
  the later Verkle, IPA, ZK, DID, and UCAN proof posture plan.

Use Continuum vocabulary when Jim/Echo facts need to become portable:

- participant descriptors;
- observation profile fixtures;
- multidimensional evidence posture;
- contract index and `qw doctor` conformance reports;
- WARP TTD discovery and generic attach behavior;
- future capability and proof presentation posture.

Do not put Jim-only `:why` tasks in Continuum unless the task defines portable
protocol shape or conformance evidence for other participants.

## WF-0106 Relationship

WF-0106 is the supporting product surface plan:

- [#192 WF-0106: Emacs ideas to steal causally](https://github.com/flyingrobots/jedit/issues/192)

It should reinforce `:why` by adding command catalog, describe surfaces, prefix
help, register provenance, macro replay reports, buffer/mode reports, and
diagnostic/debug trace buffers. Those features consume the same command and
evidence truth; they do not replace WF-0108A.

## Execution Order

1. Lock this roadmap and issue topology through [#173](https://github.com/flyingrobots/jedit/issues/173).
2. Add the local `JeditWhyObservation` model through [#174](https://github.com/flyingrobots/jedit/issues/174).
3. Add typed local evidence obstructions through [#177](https://github.com/flyingrobots/jedit/issues/177).
4. Upgrade text-window evidence fields through [#175](https://github.com/flyingrobots/jedit/issues/175).
5. Wire Echo reading identity when Echo exposes the needed refs through [#176](https://github.com/flyingrobots/jedit/issues/176).
6. Prove `dw` end to end through [#178](https://github.com/flyingrobots/jedit/issues/178).
7. Expand the command set through [#179](https://github.com/flyingrobots/jedit/issues/179).
8. Add future proof posture slots through [#180](https://github.com/flyingrobots/jedit/issues/180).

This order keeps Jim useful before the full protocol and crypto posture are
available, while preventing fake evidence claims.

## Non-Goals

- Do not rename the repo, package, contracts, or WSC directories.
- Do not move Jim editor nouns into Echo.
- Do not route Jim/Echo integration through Continuum.
- Do not implement Verkle, IPA, ZK, DID, or UCAN proof systems in jedit.
- Do not claim native cryptographic proof strength before witnesses exist.
- Do not let `:why` become a raw debug dump.

## Acceptance Criteria

- `:why` explains the last meaningful command in user-facing Jim terms.
- JSON witness output contains the same core facts without terminal scraping.
- Missing, stale, partial, unsupported, redacted, or translated evidence is
  machine-readable.
- `dw`, `dd`, `ciw`, and `gUap` each have command assertions covering command
  identity, target, range or transform, register posture where applicable, and
  evidence posture.
- Echo evidence is cited through generic reading/receipt refs, not Jim nouns.
- Continuum protocol terms are used only where the evidence crosses participant
  boundaries.

## Validation Plan

Roadmap-lock PRs should run:

```bash
npx --yes markdownlint-cli2 \
  docs/BEARING.md \
  docs/design/0106-emacs-ideas-to-steal-causally.md \
  docs/design/0108-causal-command-provenance-surface.md \
  docs/design/0108a-why-observation-evidence-roadmap.md
node --test --test-concurrency=1 spec/design-cycle-policy.spec.mjs
git diff --check
```

Implementation PRs must add focused runtime tests for the specific slice and
run the relevant command-provenance, witness, and Echo-history specs.

## Retrospective

To fill when WF-0108A lands or is superseded.
