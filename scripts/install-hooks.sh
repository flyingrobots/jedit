#!/usr/bin/env bash
# Install this repository's hooks for this clone and every linked worktree.
# core.hooksPath is local configuration: merging the hooks does not install
# them for anyone.
#
# core.hooksPath points at launchers in the shared git directory rather than
# at scripts/hooks itself. A relative scripts/hooks resolves inside each
# worktree, so a worktree whose sparse checkout omits it would silently run
# no hooks at all. Each launcher runs the worktree's own tracked hook, refuses
# the commit or push when that hook is tracked but missing, and steps aside
# only on a branch that predates the hooks.
set -euo pipefail

launchers="$(git rev-parse --path-format=absolute --git-common-dir)/jedit-hooks"
mkdir -p "$launchers"

for name in pre-commit pre-push; do
  cat > "$launchers/$name" <<'LAUNCHER'
#!/usr/bin/env bash
# Installed by scripts/install-hooks.sh. Git runs hooks from the worktree's
# top level, so this runs that worktree's tracked hook.
set -euo pipefail
name="$(basename "$0")"
hook="$PWD/scripts/hooks/$name"
if [[ -x "$hook" ]]; then
  exec "$hook" "$@"
fi
if git cat-file -e "HEAD:scripts/hooks/$name" 2>/dev/null; then
  echo "jedit hooks: this branch tracks scripts/hooks/$name, but it is missing from this worktree (sparse checkout?)." >&2
  echo "Refusing to skip it. Add scripts/hooks to the sparse checkout, then try again." >&2
  exit 1
fi
echo "jedit hooks: scripts/hooks/$name is not part of this branch; skipping it." >&2
LAUNCHER
  chmod +x "$launchers/$name"
done

git config --local core.hooksPath "$launchers"
echo "core.hooksPath = $(git config --local core.hooksPath)"
