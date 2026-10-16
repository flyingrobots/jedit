# Sourced by the hooks in scripts/hooks/. Not a hook itself.
#
# The pre-commit checks run on the working tree, but git commits the index.
# A tracked file with both staged and unstaged changes breaks the link
# between them: the checks would validate the working copy while the commit
# records the staged copy. refuse_partial_staging stops the commit before
# any check runs.
#
# Call it before enter_repository. During `git commit -a` or
# `git commit <paths>`, git points GIT_INDEX_FILE at the index the commit
# will record, and enter_repository clears that variable.
#
# Scope: unstaged work in other files and untracked files are still allowed.
# A repository-wide check can therefore still see changes this commit does
# not contain. Checking an index-derived checkout would close that gap.

refuse_partial_staging() {
  local partial
  partial="$(comm -12 \
    <(git diff --cached --name-only | sort) \
    <(git diff --name-only | sort))"
  if [[ -n "$partial" ]]; then
    {
      echo "pre-commit: these files have both staged and unstaged changes:"
      sed 's/^/  /' <<<"$partial"
      echo "The checks run on the working tree, so they would not validate"
      echo "what this commit records. Stage or stash the rest, then commit again."
    } >&2
    return 1
  fi
}
