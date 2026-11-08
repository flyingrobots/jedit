# shellcheck shell=bash
# Sourced by the hooks in scripts/hooks/. Not a hook itself.
#
# Git commits the tree `git write-tree` builds from the index, not the raw
# index entries and not the working tree. staged_snapshot_commit wraps that
# exact tree in an unreferenced commit so pre-commit can check it out like any
# other commit: intent-to-add entries are absent, skip-worktree entries are
# present, and attributes come from the staged .gitattributes. Git collects
# the unreferenced commit with other loose objects.
#
# Call it before enter_repository. During `git commit -a` or
# `git commit <paths>`, git points GIT_INDEX_FILE at the index the commit
# will record, and enter_repository clears that variable.

staged_snapshot_commit() {
  local tree
  tree="$(git write-tree)"
  GIT_AUTHOR_NAME="jedit pre-commit" GIT_AUTHOR_EMAIL="hooks@jedit.invalid" \
    GIT_COMMITTER_NAME="jedit pre-commit" GIT_COMMITTER_EMAIL="hooks@jedit.invalid" \
    git commit-tree "$tree" -m "pre-commit snapshot"
}
