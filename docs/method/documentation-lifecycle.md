# Documentation Lifecycle

This document owns when repository documentation is kept, rewritten, or deleted. It is listed in the ownership register in [durable-decisions.md](durable-decisions.md); `AGENTS.md` links here and adds nothing that contradicts it.

## Git history is the archive

Documentation in this repository describes what is true now and what is decided for the future. It is not a museum. Git history keeps every earlier version, so the working tree never needs to.

- Delete documentation for retired interfaces, removed generation paths, superseded contracts, and abandoned implementation plans.
- Do not keep a document solely as historical evidence, and do not create archive, graveyard, or "legacy" directories or banners to hold one.
- When a document is deleted or moved, repair every link, router, index, and entrance that pointed at it in the same change.
- Record what was deleted and why in the pull request description, not in a permanent file.

## Deciding that something is obsolete

A reference to code that no longer exists is a reason to look, not a verdict. Before classifying a document, confirm what happened to each thing it names:

- removed, renamed, or moved (and to where);
- generated at build time into an ignored path;
- owned by another repository (Echo, Edict, Graft, Bijou);
- planned by an accepted design that is still active.

Check current code, build and generation scripts, accepted decisions, and open work. Then:

- **Keep** a document that is accurate and current.
- **Rewrite** a document whose purpose is current but whose passages are false. Fix the passages; do not add a caveat that the rest is outdated.
- **Delete** a document whose subject is retired or whose only remaining value is narrating how something used to be built.

Current accepted architecture and ownership rules stay explicit. An active, authorized design is not obsolete because its implementation is incomplete; it must say plainly which parts are implemented and which are target. Speculative plans and unsupported aspirations belong in GitHub issues, not in documents that present them as capabilities.

## Design cycle documents

A focused `docs/design/` document owns its cycle while the cycle is active, and afterwards only while it is still the canonical statement of a rule in force. When a cycle lands:

- Move any rule that is still binding into its canonical owner (see the register in [durable-decisions.md](durable-decisions.md)) if it is not already there.
- If the document then only narrates the cycle, delete it.
- If it remains the canonical owner of a current rule, keep it current like any other owner.

## Tests do not read documentation

No spec, test, quality gate, or CI check opens a Markdown file or asserts what a document says. Tests pin behavior: package APIs, runtime output, rendered frames, command results, schemas, and tooling. A document is checked by the people who read it, not by a test, so a documentation change never needs a test change and a test never fails because prose moved. Inaccurate documentation is fixed; behavioral tests and release gates are not weakened to make a documentation change pass.

## Unresolved authority

If whether a document still governs anything is genuinely unclear, open an issue that states the question and the evidence on each side, and leave that document unchanged until it is answered. One unresolved document does not block the rest of a cleanup.
