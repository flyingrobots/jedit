# Sourced by the hooks in scripts/hooks/. Not a hook itself.
#
# Git commits the index, not the working tree. write_staged_snapshot writes
# every file of the index this commit will record into an empty directory,
# so the pre-commit checks validate exactly the committed content: no
# unstaged edit, untracked file, or file recreated after `git rm` can make
# them pass.
#
# Call it before enter_repository. During `git commit -a` or
# `git commit <paths>`, git points GIT_INDEX_FILE at the index the commit
# will record, and enter_repository clears that variable.

write_staged_snapshot() {
  local snapshot="$1"
  git checkout-index --all --prefix="$snapshot/"
}

# Dependencies are not tracked, so the snapshot borrows the checkout's.
# Run after enter_repository, from the checkout's top level.
link_snapshot_dependencies() {
  local snapshot="$1"
  ln -s "$PWD/node_modules" "$snapshot/node_modules"
}
